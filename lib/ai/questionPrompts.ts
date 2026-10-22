/**
 * The prompts of the teacher question generators (docs/AI.md) — ONE copy,
 * shared by the /teacher/create/* routes and the classroom-games route
 * (docs/GAMES.md), so a game asks Gemini exactly what the create page asks.
 *
 * ⚠️ Moved VERBATIM out of the create routes (2026-10-21). Changing a prompt
 * here changes it for the create page AND the games — that is the point.
 * Every route sends it with the same response schema: `[{q, o[4], a, e}]`.
 */

import { fixMath } from "./fixMath";

export interface AiPrompt {
  prompt: string;
  temperature: number;
}

/** The input every generator gets; `count` is a number, `language` 'uz' | 'ru' | 'en'. */
interface Base {
  difficulty: string;
  count: number;
  language: string;
}

/** "Matn orqali" (`create/by_user_input`): any topic the teacher types. */
export function freePromptQuestions({ promptText, difficulty, count, language }: Base & { promptText: string }): AiPrompt {
  const diffLower = difficulty.toLowerCase();

  const difficultyDefinitions: Record<string, string> = {
    "easy": "Fundamental concepts, basic definitions, and single-step recall. Clear and direct.",
    "medium": "Intermediate level. Requires analysis, application of rules, or multi-step reasoning. Standard high-school level.",
    "hard": "Highly complex, advanced analysis. Synthesize multiple concepts to find the answer."
  };

  const activeDifficultyInstruction = difficultyDefinitions[diffLower] || difficultyDefinitions["medium"];

  // 🟢 TOKEN-SAVER PROMPT (Qisqartirilgan kalitlar va Massiv javoblar)
  const systemPrompt = `Role: Expert Academic Examiner. Generate exactly ${count} multiple-choice questions.
Language: ${language}. Difficulty: ${difficulty.toUpperCase()}.

CRITICAL DIFFICULTY RULE: ${activeDifficultyInstruction}
USER INSTRUCTION (Topic/Context): "${promptText}"

STRICT RULES:
1. Accuracy: Correct answer must be factually and mathematically flawless.
2. Distractors: The 3 incorrect options must be plausible misconceptions. Randomize the correct answer index (0-3) across the set.
3. Formatting: Wrap ALL math/variables in $ (inline) or $$ (blocks). Double-escape backslashes (e.g., \\\\frac, \\\\sqrt).
4. EXPLANATION: Max 15 words. Explain the core logic briefly. Must be plain text.

OUTPUT SCHEMA EXPLANATION:
"q" = Question text.
"o" = Array of exactly 4 option strings.
"a" = Index of correct option (0, 1, 2, or 3).
"e" = Explanation (Max 15 words).`;

  return { prompt: systemPrompt, temperature: 0.25 };
}

/** "Smart AI Studiya" (`create/ai`, the abiturient path): DTM-standard questions for a subject + typed topic. */
export function dtmQuestions({ subject, topic, difficulty, count, language, context }: Base & { subject: string; topic: string; context?: string }): AiPrompt {
  let subjectSpecificRule = "";
  const lowerSubject = subject.toLowerCase();

  if (["matematika", "fizika", "kimyo", "informatika"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- Yechilishi kerak bo'lgan murakkab masalalar, tenglamalar yoki mantiqiy hisoblashlarni tuzing. Shunchaki formula qanday deb so'ramang. DTM darajasidagi qiyinlikda bo'lsin.";
  } else if (["tarix", "huquq"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- Aniq sanalar, xronologiya, tarixiy shaxslar ishtirok etgan tahliliy va qiyosiy savollar tuzing.";
  } else if (["ona tili", "ingliz tili", "adabiyot", "language"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- Grammatika, so'z boyligi, matn tahlili yoki bo'sh joylarni to'ldirishga oid (fill-in-the-blanks) savollar tuzing. DTM grammatika qoidalariga asoslaning.";
  } else if (["biologiya", "geografiya"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- O'zaro bog'liqlik, qonuniyatlar va chuqur nazariy tahlil talab qiladigan savollar tuzing.";
  } else {
    subjectSpecificRule = "- O'quvchini mantiqiy fikrlashga undaydigan chuqur tahliliy va DTM formatidagi savollar tuzing.";
  }

  // 🟢 TOKEN-SAVER PROMPT
  let systemPrompt = `Role: Expert Uzbekistan Academic Examiner (DTM Standard). Generate exactly ${count} multiple-choice questions.
Params: Lang:${language}, Diff:${difficulty}, Subject:${subject}, Topic:${topic}.

CRITICAL FORMATTING & LATEX RULES:
1. Wrap ALL math, numbers, variables, and formulas in $ (for inline) or $$ (for display/blocks). NEVER use \\( \\) or \\[ \\].
2. JSON ESCAPING: You MUST double-escape all LaTeX backslashes (e.g., \\\\frac, \\\\alpha, \\\\sqrt).
3. DTM EXAM STYLE (CRITICAL):
   ${subjectSpecificRule}
   DO NOT ask simple trivia or basic definitions.
4. QUALITY: The 3 incorrect options MUST be plausible misconceptions to test real understanding. Randomize the correct answer index (0-3).
5. EXPLANATION: Max 15 words. Strictly plain text. Give the core logic or formula used.

OUTPUT SCHEMA EXPLANATION:
"q" = Question text.
"o" = Array of exactly 4 option strings.
"a" = Index of correct option (0, 1, 2, or 3).
"e" = Explanation (Max 15 words plain text).`;

  if (context && context.trim() !== "") {
    systemPrompt += `\nSTRICT CONTEXT: Base questions ONLY on this text: "${context}"`;
  }

  return { prompt: systemPrompt, temperature: 0.3 };
}

/** Ixtisoslashtirilgan maktab (`create/ixtisoslashtirilgan_maktab`). `topic` is the CLASS ("7-sinf"), as the page sends it. */
export function ixtisosQuestions({ topic, subject, difficulty, count, language, context }: Base & { topic: string; subject: string; context?: string }): AiPrompt {
  let subjectSpecificRule = "";
  const lowerSubject = subject.toLowerCase();

  if (["matematika", "fizika", "kimyo", "informatika"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- Yechilishi qiyin bo'lgan, bir necha bosqichli (multi-step) masalalar va mantiqiy boshqotirmalar tuzing. O'quvchi formulani shunchaki yodlagan emas, uni qo'llay oladigan bo'lishi shart.";
  } else if (["tarix", "huquq"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- Ma'lumotlarni yodlashni emas, balki voqea-hodisalarni tahlil qilishni, sabab-oqibat bog'lanishlarini topishni talab qiladigan qiyosiy savollar tuzing.";
  } else if (["ona tili", "ingliz tili", "adabiyot", "language"].some(s => lowerSubject.includes(s))) {
    subjectSpecificRule = "- Murakkab grammatik qoidalar, istisnolar (exceptions), matnni chuqur tushunish (reading comprehension) va mantiqiy tahlilga oid savollar tuzing.";
  } else {
    subjectSpecificRule = "- O'quvchining tanqidiy fikrlashini (critical thinking) tekshiradigan va chuqur tahlilni talab qiluvchi murakkab savollar tuzing.";
  }

  // 🟢 REFINED TOKEN-SAVER PROMPT
  let systemPrompt = `Act as an expert examiner for the Uzbekistan Specialized Schools curriculum.
Generate exactly ${count} multiple-choice questions.

TARGET AUDIENCE: Class ${topic}, Subject: ${subject}. Difficulty: ${difficulty}. Language: ${language}.

CURRICULUM BOUNDARIES & SPECIALIZED LOGIC:
You are generating questions for gifted students. 
- Avoid simple memory recall questions.
- ${subjectSpecificRule}

STRICT MATH & FORMAT RULES:
1. Wrap ALL math/variables in $ (inline) or $$ (blocks). Double-escape backslashes (e.g., \\\\frac).
2. The 3 incorrect options MUST represent logical traps or common miscalculations. Randomize the correct answer index (0-3).
3. EXPLANATION: Max 15 words! Extremely concise core logic.

OUTPUT SCHEMA EXPLANATION:
"q" = Question text.
"o" = Array of exactly 4 option strings.
"a" = Index of correct option (0, 1, 2, or 3).
"e" = Explanation (Max 15 words).`;

  if (context && context.trim() !== "") {
    systemPrompt += `\nSTRICT CONTEXT RULES FOR THIS SUBTOPIC:\n${context}`;
  }

  return { prompt: systemPrompt, temperature: 0.35 };
}

/** Maktab (`create/maktab`) — the Gemini fallback after the local bank. `topic` is the CLASS ("6-sinf"), as the page sends it. */
export function maktabQuestions({ topic, subject, difficulty, count, language, context }: Base & { topic: string; subject: string; context?: string }): AiPrompt {
  const safeSubject = subject.toLowerCase().trim();

  // 🟢 DINAMIK FAN QOIDALARI
  let subjectSpecificRule = "";
  if (["matematika", "fizika", "kimyo", "informatika"].some(s => safeSubject.includes(s))) {
    subjectSpecificRule = "- Yechilishi kerak bo'lgan amaliy masalalar, tenglamalar yoki mantiqiy hisoblashlarni tuzing.";
  } else if (["tarix", "huquq"].some(s => safeSubject.includes(s))) {
    subjectSpecificRule = "- Aniq sanalar, tarixiy shaxslar va voqealarni tahlil qiluvchi savollar tuzing.";
  } else if (["ona tili"].some(s => safeSubject.includes(s))) {
    subjectSpecificRule = "- Grammatika qoidalari va tahlilga oid savollar tuzing.";
  } else if (["english", "ingliz tili", "ingliz"].some(s => safeSubject.includes(s))) {
    
    // 🚀 EXTREMELY STRICT ENGLISH RULES
    subjectSpecificRule = `You MUST generate a diverse mix of exactly these 4 question types. Do not use the same type for all questions.

      THE 4 ALLOWED QUESTION TYPES (t):
      1. "pure_grammar": Fill-in-the-blanks or choose the correct verb/preposition. 
      2. "pure_vocab": Match a definition to a word, or logical deduction based on vocabulary. 
      3. "translate_uz_en": Translate an Uzbek word/phrase into English.
      4. "translate_en_uz": Translate an English word/phrase into Uzbek.

      CRITICAL LANGUAGE ISOLATION RULES:
      - If 't' is "pure_grammar" or "pure_vocab": The question (q), options (o), and explanation (e) MUST BE 100% IN ENGLISH. Do NOT use a single word of Uzbek.
      - If 't' is "translate_uz_en": The question (q) is in Uzbek, but the options (o) MUST be in English.
      - If 't' is "translate_en_uz": The question (q) is in English, but the options (o) MUST be in Uzbek.
      - Never use phrases like "in the picture" or "according to the audio".`;
    
  } else if (["musiqa", "musiqiy savodxonlik", "musiqa madaniyati"].some(s => safeSubject.includes(s))) {
    subjectSpecificRule = `MUSIQA FANI UCHUN QAT'IY QOIDALAR:
      1. Qo'shiq yoki she'r qatorlarini yoddan davom ettirishni so'raydigan savollar (masalan: "keyingi qatorni toping") QAT'IYAN TAQIQLANADI. AI o'zbek she'rlarini xato to'qib chiqarishi mumkin.
      2. Asosiy e'tiborni berilgan Kontekstdagi qahramonlar tahlili, qo'shiqning tarbiyaviy ma'nosi (Moral) va kayfiyatiga qarating.
      3. Musiqa nazariyasi so'ralganda cholg'u asboblarining turlari (torli, zarbli, puflama), dinamika (qattiq/sekin), temp va registr bo'yicha mantiqiy savollar tuzing.`;
  // 👆 ============================= 👆

  } else {
    subjectSpecificRule = "- O'quvchini mantiqiy fikrlashga undaydigan va darslikka to'liq mos keladigan savollar tuzing.";
  }

  // 🟢 TOKEN SAVER PROMPT (Qisqartirilgan kalitlar va Massiv javoblar)
  let systemPrompt = `Act as an expert examiner for the Uzbekistan public school system (Maktab).
Generate exactly ${count} multiple-choice questions.

TARGET AUDIENCE: Class ${topic}, Subject: ${subject}. Difficulty: ${difficulty}. Language: ${language}.

CURRICULUM BOUNDARIES & STYLE:
1. You are generating questions purely based on the curriculum topic name. Ensure the logic strictly aligns with what a ${topic} student in Uzbekistan learns in ${subject}. Do not use concepts from higher grades.
2. ${subjectSpecificRule}
3. The 3 incorrect options MUST be plausible misconceptions. Randomize the correct answer index (0-3) across the set.

STRICT MATH/SCIENCE FORMATTING (CRITICAL):
1. Wrap ALL math, numbers, variables, and equations in $ (for inline) or $$ (for display/blocks). NEVER use \\( \\) or \\[ \\].
2. JSON ESCAPING: You MUST double-escape all LaTeX commands (e.g., \\\\frac, \\\\alpha).
3. EXPLANATION: Max 15 words! Extremely concise core logic.

OUTPUT SCHEMA EXPLANATION:
"q" = Question text.
"o" = Array of exactly 4 option strings.
"a" = Index of correct option (0, 1, 2, or 3).
"e" = Explanation (Max 15 words).`;

  if (context && context.trim() !== "") {
    systemPrompt += `\nSTRICT CONTEXT RULES FOR THIS SUBTOPIC:\n${context}`;
  }

  return { prompt: systemPrompt, temperature: 0.25 };
}

/** One generated question: stem, 4 options, correct index, short explanation. */
export interface McqItem {
  q: string;
  o: string[];
  a: number;
  e: string;
}

/** The response schema every MCQ generator above is sent with (create routes + games). */
export const MCQ_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      q: { type: "STRING" },
      o: { type: "ARRAY", items: { type: "STRING" } },
      a: { type: "INTEGER" },
      e: { type: "STRING" },
    },
    required: ["q", "o", "a", "e"],
  },
};

/** Generated questions with any math the AI left bare wrapped in `$…$` (see lib/ai/fixMath.ts). */
export const cleanMcqItems = (items: McqItem[]): McqItem[] =>
  (Array.isArray(items) ? items : []).map((it) => ({
    ...it,
    q: fixMath(it.q ?? ""),
    o: Array.isArray(it.o) ? it.o.map((o) => fixMath(String(o ?? ""))) : it.o,
    e: fixMath(it.e ?? ""),
  }));
