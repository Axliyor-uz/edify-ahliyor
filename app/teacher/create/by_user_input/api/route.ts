import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper"; 
import { freePromptQuestions, type McqItem } from "@/lib/ai/questionPrompts";
import { generateMcqs } from "@/lib/ai/generateMcqs";

// 🟢 jsonrepair importi butunlay olib tashlandi, u endi umuman kerak emas!

export async function POST(req: Request) {
  try {
    const { userId, promptText, difficulty, count, language = "uz" } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Foydalanuvchi tasdiqlanmadi (User ID missing)" }, { status: 401 });
    }

    // =========================================================================
    // 🟢 LIMIT CHECK ONLY: Open to everyone, respects their monthly limits
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

    // 🟢 AI CALL — prompt shared with the games (lib/ai/questionPrompts.ts), provider from lib/ai/models.ts;
    // solutions checked against the answer, dropped ones regenerated once (lib/ai/generateMcqs.ts)
    const rawAiQuestions: McqItem[] = await generateMcqs({ build: (n) => freePromptQuestions({ promptText, difficulty, count: n, language }), count, language });

    // 🟢 MAP TO STANDARD FRONTEND FORMAT
    const letterMap = ["A", "B", "C", "D"];

    const formattedQuestions = rawAiQuestions.map((item: any) => ({
      id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: "mcq",
      points: 2,
      uiDifficulty: difficulty,
      difficultyId: diffVal,
      subject: "by_prompt",
      topic: "by_prompt",
      chapter: "by_prompt",
      subtopic: "by_prompt",
      question: { uz: item.q || "" },
      options: {
        A: { uz: item.o[0] || "" },
        B: { uz: item.o[1] || "" },
        C: { uz: item.o[2] || "" },
        D: { uz: item.o[3] || "" }
      },
      answer: letterMap[item.a] || "A", // Indeksni (0-3) Harfga (A-D) o'giramiz
      explanation: { uz: item.e || "" } 
    }));

    // =========================================================================
    // 🟢 DEDUCTION LOGIC: Deduct limits securely
    // =========================================================================
    await deductMonthlyAiCredits(userId, formattedQuestions.length);

    return NextResponse.json({ questions: formattedQuestions });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate questions" }, { status: 500 });
  }
}