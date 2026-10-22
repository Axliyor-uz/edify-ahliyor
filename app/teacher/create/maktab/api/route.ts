import { NextResponse } from 'next/server';

// 🟢 NEW: Admin DB and the Deduction Gatekeeper
import { adminDb } from '@/lib/firebaseAdmin';
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper";

// 🟢 Local bank + prompt — shared with the classroom games (lib/ai/*)
import { findMaktabBankQuestions } from "@/lib/ai/maktabBank";
import { maktabQuestions } from "@/lib/ai/questionPrompts";

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({})); 
    const { 
      userId, 
      topic = "", 
      subject = "", 
      chapter = "", 
      subtopic = "", 
      difficulty = "medium", 
      count = 5, 
      language = "uz", 
      context = "" 
    } = payload;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

    if (!userId) return NextResponse.json({ error: "Foydalanuvchi tasdiqlanmadi" }, { status: 401 });
    
    // =========================================================================
    // 🟢 LIMIT CHECK ONLY (Accessible to everyone, checks Monthly Limits)
    // =========================================================================
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      const userData = userSnap.data();
      const monthlyLimit = userData?.currentLimits?.monthlyAiQuestions || 100;
      const aiUsed = userData?.usage?.aiQuestionsUsed || 0;
      const isUnlimited = monthlyLimit >= 5000;

      if (!isUnlimited && (aiUsed + count > monthlyLimit)) {
        return NextResponse.json({ 
          error: "Oylik AI limitingiz yetarli emas.",
          code: 'LIMIT_REACHED' 
        }, { status: 403 }); 
      }
    }
    // =========================================================================

    const diffLower = difficulty.toLowerCase();
    const diffVal = diffLower === "easy" ? 1 : diffLower === "hard" ? 3 : 2;

    // =========================================================================
    // 🚀 ULTRA-FAST FIREBASE STORAGE INTERCEPTOR (WITH RAM CACHING)
    // =========================================================================
    const safeSubject = subject.toLowerCase().trim();
    const safeGrade = topic.toLowerCase().trim();

    const bankQuestions = await findMaktabBankQuestions(safeSubject, safeGrade, chapter, subtopic);
    if (bankQuestions) {
      const selectedQuestions = bankQuestions.slice(0, count);

      const formattedQuestions = selectedQuestions.map((q: any) => ({
        id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: "mcq",
        points: 2,
        uiDifficulty: difficulty, 
        difficultyId: diffVal,
        question: { uz: q.question?.[language] || q.question?.uz || q.question || "Savol topilmadi" },
        options: {
          A: { uz: q.options?.A?.[language] || q.options?.A?.uz || q.options?.A || "A" },
          B: { uz: q.options?.B?.[language] || q.options?.B?.uz || q.options?.B || "B" },
          C: { uz: q.options?.C?.[language] || q.options?.C?.uz || q.options?.C || "C" },
          D: { uz: q.options?.D?.[language] || q.options?.D?.uz || q.options?.D || "D" }
        },
        answer: q.answer || "A",
        explanation: { uz: q.explanation?.uz || q.explanation || "" } 
      }));

      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // 🟢 Deduct limits securely for cached questions
      await deductMonthlyAiCredits(userId, formattedQuestions.length);

      return NextResponse.json({ questions: formattedQuestions });
    }
    // =========================================================================

    // =========================================================================
    // 🔴 TOKEN-SAVER GEMINI AI GENERATION (WITH MINIFIED SCHEMA)
    // =========================================================================
    
    const { prompt: systemPrompt, temperature } = maktabQuestions({ topic, subject, difficulty, count, language, context });

    // 🟢 GEMINI API CALL WITH MINIFIED RESPONSE SCHEMA
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: { 
          temperature,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                q: { type: "STRING" },
                o: { type: "ARRAY", items: { type: "STRING" } }, // 🟢 Options are now an Array!
                a: { type: "INTEGER" }, // 🟢 Answer is just a number (0-3)
                e: { type: "STRING" }
              },
              required: ["q", "o", "a", "e"]
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini Error");

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error(data.candidates?.[0]?.finishReason === "SAFETY" 
        ? "AI xavfsizlik filtri: Bu mavzu bo'yicha savol tuzish taqiqlangan." 
        : "AI kutilmagan javob qaytardi. Qayta urinib ko'ring.");
    }

    // 🟢 SCHEMA kafolati bilan to'g'ridan-to'g'ri Parse qilish
    const rawAiQuestions = JSON.parse(generatedText);

    // 🟢 MAP TO STANDARD FRONTEND FORMAT (Translates [0,1,2,3] -> A, B, C, D)
    const letterMap = ["A", "B", "C", "D"];

    const enrichedQuestions = rawAiQuestions.map((item: any) => ({
      id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: "mcq",
      points: 2,
      uiDifficulty: difficulty,
      difficultyId: diffVal,
      question: { uz: item.q || "" },
      options: {
        A: { uz: item.o[0] || "" },
        B: { uz: item.o[1] || "" },
        C: { uz: item.o[2] || "" },
        D: { uz: item.o[3] || "" }
      },
      answer: letterMap[item.a] || "A", // Map index to Letter
      explanation: { uz: item.e || "" } 
    }));

    // 🟢 Deduct limits securely for AI generated questions
    await deductMonthlyAiCredits(userId, enrichedQuestions.length); 

    return NextResponse.json({ questions: enrichedQuestions });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message || "Tizim xatoligi yuz berdi" }, { status: 500 });
  }
}