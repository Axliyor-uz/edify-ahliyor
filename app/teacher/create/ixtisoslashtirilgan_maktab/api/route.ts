import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper"; 
import { ixtisosQuestions } from "@/lib/ai/questionPrompts";

export async function POST(req: Request) {
  try {
    const { userId, topic, subject, chapter, subtopic, difficulty, count, language = "uz", context } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });

    if (!userId) {
      return NextResponse.json({ error: "Foydalanuvchi tasdiqlanmadi" }, { status: 401 });
    }

    // =========================================================================
    // 🟢 LIMIT CHECK ONLY (Checks Monthly Limits, No Feature Lock)
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

    // 🟢 Calculate numeric difficulty safely
    const diffLower = difficulty.toLowerCase();
    const diffVal = diffLower === "easy" ? 1 : diffLower === "hard" ? 3 : diffLower === "olympiad" ? 4 : 2;

    // 🟢 PROMPT — shared with the classroom games (lib/ai/questionPrompts.ts)
    const { prompt: systemPrompt, temperature } = ixtisosQuestions({ topic, subject, difficulty, count, language, context });

    // 🟢 GEMINI API WITH MINIFIED RESPONSE SCHEMA
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

    // 🟢 Safe Direct Parsing
    const rawAiQuestions = JSON.parse(generatedText);

    // 🟢 MAP TO STANDARD FRONTEND FORMAT (A, B, C, D)
    const letterMap = ["A", "B", "C", "D"];

    const enrichedQuestions = rawAiQuestions.map((item: any) => ({
      id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: "mcq",
      points: 2,
      uiDifficulty: difficulty, 
      difficultyId: diffVal,
      subject: subject,
      topic: topic,
      chapter: chapter,
      subtopic: subtopic,
      question: { uz: item.q || "" },
      options: {
        A: { uz: item.o[0] || "" },
        B: { uz: item.o[1] || "" },
        C: { uz: item.o[2] || "" },
        D: { uz: item.o[3] || "" }
      },
      answer: letterMap[item.a] || "A", // Map index back to letter
      explanation: { uz: item.e || "" } 
    }));

    // =========================================================================
    // 🟢 AI LIMIT DEDUCTION
    // =========================================================================
    await deductMonthlyAiCredits(userId, enrichedQuestions.length);

    return NextResponse.json({ questions: enrichedQuestions });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message || "Tizim xatoligi yuz berdi" }, { status: 500 });
  }
}