import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { deductMonthlyAiCredits } from "@/lib/ai/featureGatekeeper";
import { generateJson } from "@/lib/ai/generate";
import { SOLUTION_RULE, checkMcqItems } from "@/lib/ai/questionPrompts";

export async function POST(req: Request) {
  try {
    const { 
      userId, 
      schoolType,
      assessmentType, 
      topic, 
      subject, 
      scopes, 
      difficulty, 
      distribution, 
      language = "uz" 
    } = await req.json();

    const totalQuestions = distribution.reduce((acc: number, curr: any) => acc + curr.count, 0);

    if (!userId) return NextResponse.json({ error: "User unauthorized" }, { status: 401 });
    
    // =========================================================================
    // 🟢 LIMIT CHECK ONLY: Checks Monthly Limits
    // =========================================================================
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();
    
    if (userSnap.exists) {
      const userData = userSnap.data();
      const monthlyLimit = userData?.currentLimits?.monthlyAiQuestions || 100;
      const aiUsed = userData?.usage?.aiQuestionsUsed || 0;
      const isUnlimited = monthlyLimit >= 5000;

      if (!isUnlimited && (aiUsed + totalQuestions > monthlyLimit)) {
        return NextResponse.json({ 
          error: "Oylik AI limitingiz yetarli emas.",
          code: 'LIMIT_REACHED' 
        }, { status: 403 }); 
      }
    }
    // =========================================================================

    const distRules = distribution.map((d: any) => 
      `- ${d.count} questions of type "${d.id}" (Worth ${d.points} points each)`
    ).join("\n");

    const schoolContext = schoolType === "ixtisos" 
      ? "Specialized/Gifted Schools (requires deep analytical thinking, multi-step logic, and complex problem solving)" 
      : "Standard Public Schools (requires clear, curriculum-aligned questions based on standard textbooks)";

    // 🟢 TOKEN-SAVER PROMPT WITH UNIVERSAL SCHEMA INSTRUCTIONS
    const systemPrompt = `You are an expert exam creator for Uzbekistan ${schoolContext}.
You are generating a summative assessment (${assessmentType}).

<context>
Grade: ${topic}, Subject: ${subject}, Difficulty: ${difficulty}, Language: ${language}.
Topics Covered: ${scopes.join(", ")}
</context>

<instructions>
Generate EXACTLY ${totalQuestions} questions based on this distribution:
${distRules}

CRITICAL RULES:
1. LATEX: Wrap ALL math, numbers, and formulas in $ (inline) or $$ (display). Double-escape LaTeX commands (e.g., \\\\frac, \\\\sqrt).
2. OUTPUT SCHEMA: You must return a JSON array of objects. EVERY object must include all keys (t, p, to, q, o, m, e, a, ru). If a key is not needed for a specific question type, leave it empty ("" or []).
3. "t" = type (mcq, short_answer, open_ended, matching, true_false)
4. "p" = points (integer)
5. "to" = topic name
6. "q" = question text
7. "e" = worked solution for EVERY type, written BEFORE "a" (SOLUTION RULES below). For non-mcq types end it with "Javob: <the answer itself>" instead of a letter.

TYPE SPECIFIC RULES:
- mcq: "o" MUST be an array of 4 option strings. "a" MUST be the index of correct option ("0", "1", "2", "3").
- short_answer: "a" MUST be the exact answer text. "o", "m", "ru" remain empty.
- open_ended: "a" MUST be the full model solution: at most 4 numbered steps, about 50 words. "ru" MUST be the grading rubric no more than 10 words. "o", "m" empty.
- matching: "m" MUST be an array of exactly 3 or 4 objects {"l": "Term", "r": "Definition"}. "a", "o", "ru" empty.
- true_false: "a" MUST be strictly "true" or "false". "o", "m", "ru" empty.

${SOLUTION_RULE}
</instructions>`;

    // 🟢 AI CALL — provider + model come from lib/ai/models.ts (minified response schema)
    const rawAiQuestions: unknown[] = await generateJson({
      feature: 'questions',
      prompt: systemPrompt,
      temperature: 0.3,
      schema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            t: { type: "STRING" },
            p: { type: "INTEGER" },
            to: { type: "STRING" },
            q: { type: "STRING" },
            o: { type: "ARRAY", items: { type: "STRING" } }, // Only for MCQ
            m: { type: "ARRAY", items: { type: "OBJECT", properties: { l: { type: "STRING" }, r: { type: "STRING" } }, required: ["l", "r"] } }, // Only for Matching
            e: { type: "STRING" }, // Worked solution — BEFORE "a", so the answer comes from it
            a: { type: "STRING" }, // Answer (index, text, or boolean string)
            ru: { type: "STRING" } // Only for Open Ended
          },
          required: ["t", "p", "to", "q", "o", "m", "e", "a", "ru"],
          propertyOrdering: ["t", "p", "to", "q", "o", "m", "e", "a", "ru"]
        }
      },
    });
    const letterMap = ["A", "B", "C", "D"];

    // MCQs whose solution disagrees with the marked answer are dropped (no retry: the distribution is fixed).
    const checkedQuestions = rawAiQuestions.flatMap((raw) => {
      const item = (raw ?? {}) as { t?: string; q?: string; o?: string[]; e?: string; a?: string };
      if (item.t !== "mcq") return [raw];
      const [ok] = checkMcqItems([{ q: item.q ?? "", o: item.o ?? [], e: item.e ?? "", a: parseInt(item.a ?? "") }], language);
      return ok ? [{ ...item, e: ok.e }] : [];
    });

    // 🟢 MAP MINIFIED DATA TO THE EXACT FRONTEND FORMAT
    const formattedQuestions = checkedQuestions.map((item: any) => {
      let base: any = {
        id: `tq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: item.t,
        points: item.p,
        difficulty: difficulty,
        topic: item.to,
        question: { uz: item.q || "" },
        explanation: { uz: item.e || "" }
      };

      if (item.t === "mcq") {
        base.options = {
          A: { uz: item.o[0] || "" },
          B: { uz: item.o[1] || "" },
          C: { uz: item.o[2] || "" },
          D: { uz: item.o[3] || "" }
        };
        base.answer = letterMap[parseInt(item.a)] || "A";
      } 
      else if (item.t === "short_answer") {
        base.answer = { uz: item.a || "" };
      } 
      else if (item.t === "open_ended") {
        base.answer = { uz: item.a || "" };
        base.rubric = { uz: item.ru || "" };
      } 
      else if (item.t === "matching") {
        base.question = { uz: "Quyidagilarni moslashtiring: " + (item.q || "") };
        base.pairs = (item.m || []).map((pair: any) => ({
          left: { uz: pair.l || "" },
          right: { uz: pair.r || "" }
        }));
      } 
      else if (item.t === "true_false") {
        base.answer = (item.a === "true" || item.a === "1" || item.a?.toLowerCase() === "rost" || item.a?.toLowerCase() === "true");
      }

      return base;
    });

    // =========================================================================
    // 🟢 DEDUCTION LOGIC
    // =========================================================================
    await deductMonthlyAiCredits(userId, formattedQuestions.length);

    return NextResponse.json({ questions: formattedQuestions });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}