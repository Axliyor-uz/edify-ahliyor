import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper"; 
import { dtmQuestions, type McqItem } from "@/lib/ai/questionPrompts";
import { generateMcqs } from "@/lib/ai/generateMcqs";

export async function POST(req: Request) {
  try {
    const { userId, subject, topic, difficulty, count, language = "uz", context } = await req.json();

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

    // 🟢 AI CALL — prompt shared with the games (lib/ai/questionPrompts.ts), provider from lib/ai/models.ts;
    // solutions checked against the answer, dropped ones regenerated once (lib/ai/generateMcqs.ts)
    const rawAiQuestions: McqItem[] = await generateMcqs({ build: (n) => dtmQuestions({ subject, topic, difficulty, count: n, language, context }), count, language });

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