import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper"; 
import { ixtisosQuestions, MCQ_SCHEMA, cleanMcqItems, type McqItem } from "@/lib/ai/questionPrompts";
import { generateJson } from "@/lib/ai/generate";

export async function POST(req: Request) {
  try {
    const { userId, topic, subject, chapter, subtopic, difficulty, count, language = "uz", context } = await req.json();

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

    // 🟢 AI CALL — provider + model come from lib/ai/models.ts
    const rawAiQuestions: McqItem[] = cleanMcqItems(await generateJson({ feature: 'questions', prompt: systemPrompt, temperature, schema: MCQ_SCHEMA }));

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