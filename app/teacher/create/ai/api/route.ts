import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper"; 
import { dtmQuestions } from "@/lib/ai/questionPrompts";

export async function POST(req: Request) {
  try {
    const { userId, subject, topic, difficulty, count, language = "uz", context } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing in .env.local" }, { status: 500 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Foydalanuvchi tasdiqlanmadi (User ID missing)" }, { status: 401 });
    }

    // ==========================================
    // 🟢 LIMIT CHECK ONLY (Accessible to everyone)
    // ==========================================
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
    // ==========================================

    // 🟢 PROMPT — shared with the classroom games (lib/ai/questionPrompts.ts)
    const { prompt: systemPrompt, temperature } = dtmQuestions({ subject, topic, difficulty, count, language, context });

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
                o: { type: "ARRAY", items: { type: "STRING" } }, // Javoblar Array formatida
                a: { type: "INTEGER" }, // To'g'ri javob indeksi
                e: { type: "STRING" }   // 🟢 Xato tuzatildi: "e" qat'iy STRING formatida bo'lishi shart!
              },
              required: ["q", "o", "a", "e"]
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini API Error");

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error("AI javob qaytarmadi.");

    // 🟢 SCHEMA kafolati bo'lgani uchun to'g'ridan-to'g'ri parse qilamiz (jsonrepair kerak emas)
    const rawAiQuestions = JSON.parse(generatedText);

    let diffVal = 2; 
    const lowerDiff = difficulty ? difficulty.toLowerCase() : "medium";
    if (lowerDiff === "easy") diffVal = 1;
    else if (lowerDiff === "hard") diffVal = 3;
    else if (lowerDiff === "olympiad") diffVal = 4;

    // Harf xaritasi (0 -> A, 1 -> B ...)
    const letterMap = ["A", "B", "C", "D"];

    // 🟢 MAP MINIFIED JSON TO FRONTEND FORMAT
    const formattedQuestions = rawAiQuestions.map((item: any) => ({
      id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      uiDifficulty: difficulty,
      difficultyId: diffVal,
      question: { uz: item.q || "", ru: "", en: "" },
      options: {
        A: { uz: item.o[0] || "", ru: "", en: "" },
        B: { uz: item.o[1] || "", ru: "", en: "" },
        C: { uz: item.o[2] || "", ru: "", en: "" },
        D: { uz: item.o[3] || "", ru: "", en: "" }
      },
      answer: letterMap[item.a] || "A", // Indeksni harfga aylantirish
      explanation: { uz: item.e || "", ru: "", en: "" } // 🟢 "e" endi aniq yozuv bo'lib tushadi
    }));

    // ==========================================
    // 🟢 AI LIMIT DEDUCTION
    // ==========================================
    await deductMonthlyAiCredits(userId, formattedQuestions.length);
    // ==========================================

    return NextResponse.json({ questions: formattedQuestions });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}