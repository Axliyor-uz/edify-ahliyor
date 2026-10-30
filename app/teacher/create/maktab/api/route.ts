import { NextResponse } from 'next/server';

// 🟢 NEW: Admin DB and the Deduction Gatekeeper
import { adminDb } from '@/lib/firebaseAdmin';
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper";

// 🟢 Local bank + prompt — shared with the classroom games (lib/ai/*)
import { findMaktabBankQuestions } from "@/lib/ai/maktabBank";
import { maktabQuestions, type McqItem } from "@/lib/ai/questionPrompts";
import { generateMcqs } from "@/lib/ai/generateMcqs";

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
    // 🟢 AI CALL — prompt shared with the games (lib/ai/questionPrompts.ts), provider from lib/ai/models.ts;
    // solutions checked against the answer, dropped ones regenerated once (lib/ai/generateMcqs.ts)
    const rawAiQuestions: McqItem[] = await generateMcqs({ build: (n) => maktabQuestions({ topic, subject, difficulty, count: n, language, context }), count, language });

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