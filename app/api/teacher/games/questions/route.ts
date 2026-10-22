import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { checkUserPermission, deductMonthlyAiCredits } from '@/lib/ai/featureGatekeeper';
import { dtmQuestions, freePromptQuestions, ixtisosQuestions, maktabQuestions, type GeminiPrompt } from '@/lib/ai/questionPrompts';
import { findMaktabBankQuestions } from '@/lib/ai/maktabBank';
import { EXAM_SUBJECTS, MAX_TOPIC, TRACKS, isKnownSubject, normalizeSyllabus, subjectLabel } from '@/app/teacher/games/_lib/aiSource';

// Reads the local syllabus JSON from disk (docs/AI.md: fs routes must be dynamic).
export const dynamic = 'force-dynamic';

/**
 * Questions for the classroom games (docs/GAMES.md → "AI bilan yaratish"),
 * made EXACTLY like the matching /teacher/create page: the same prompt
 * builders (lib/ai/questionPrompts.ts) and, for Maktab, the same local bank
 * first (lib/ai/maktabBank.ts). Games only add: a Gemini top-up when the bank
 * has fewer questions than asked, and dropping malformed questions.
 *
 * Body: { source: AiSource (_lib/aiSource.ts), difficulty: 'easy'|'medium'|'hard', count, language: 'uz'|'ru'|'en' }.
 * Syllabus sources send only grade/subject/positions; topic names and notes
 * are read here from data/{track}/…/syllabus.json. Returns { questions } in
 * the legacy question shape every reader normalizes.
 *
 * ⚠️ Identity is SERVER-OWNED: the uid comes from the verified ID token, never
 * from the body (the create/* routes still trust a body `userId` — don't copy them).
 * Credits: monthly AI limit (docs/AI.md, system B) — check → generate →
 * deduct what is returned, bank questions included (as create/maktab does).
 */

const MIN_COUNT = 5;
const MAX_COUNT = 30;
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const LANGUAGES = ['uz', 'ru', 'en'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

type Raw = Record<string, unknown>;
type GameQuestion = { id: string; type: 'mcq'; difficulty: string; question: Raw; options: Raw; answer: string };

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const okTopic = (t: string) => t.length >= 2 && t.length <= MAX_TOPIC;

interface Plan {
  /** Ready questions (Maktab local bank), used first. */
  bank: Raw[];
  /** The create page's prompt for `n` questions. */
  prompt: (n: number) => GeminiPrompt;
}

/** The create page's recipe for this source — or null when the source is invalid. */
async function planFor(raw: unknown, difficulty: string, language: string): Promise<Plan | null> {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Raw;

  if (src.kind === 'topic') {
    const promptText = text(src.topic);
    if (!okTopic(promptText)) return null;
    return { bank: [], prompt: (count) => freePromptQuestions({ promptText, difficulty, count, language }) };
  }

  if (src.kind === 'abiturient') {
    const subject = text(src.subject);
    const topic = text(src.topic);
    if (!(EXAM_SUBJECTS as readonly string[]).includes(subject) || !okTopic(topic)) return null;
    // create/ai sends no context for the abiturient studio.
    return { bank: [], prompt: (count) => dtmQuestions({ subject, topic, difficulty, count, language }) };
  }

  if (src.kind === 'maktab' || src.kind === 'ixtisos') {
    const kind = src.kind;
    const grade = text(src.grade);
    const subject = text(src.subject);
    const ci = Number(src.chapter);
    const ti = Number(src.topic);
    if (!isKnownSubject(kind, grade, subject) || !Number.isInteger(ci) || !Number.isInteger(ti)) return null;
    let chapters;
    try {
      const file = path.join(process.cwd(), 'data', TRACKS[kind].folder, grade, subject, 'syllabus.json');
      chapters = normalizeSyllabus(JSON.parse(await readFile(file, 'utf8')), subjectLabel(subject));
    } catch {
      return null;
    }
    const chapter = chapters[ci];
    const sub = chapter?.topics[ti];
    if (!sub) return null;
    // The create pages send the class as `topic` and the folder name as `subject`.
    const input = { topic: grade, subject, difficulty, language, context: sub.context };
    if (kind === 'ixtisos') return { bank: [], prompt: (count) => ixtisosQuestions({ ...input, count }) };
    const bank = await findMaktabBankQuestions(subject.toLowerCase().trim(), grade.toLowerCase().trim(), chapter.name, sub.name);
    return { bank: bank ?? [], prompt: (count) => maktabQuestions({ ...input, count }) };
  }

  return null;
}

/** One playable question: a stem, 4 distinct options, a valid answer — or null. */
function playable(stem: string, options: string[], answer: number, id: string, difficulty: string, language: string): GameQuestion | null {
  const keys = options.map((o) => o.toLowerCase());
  if (!stem || options.length !== 4 || !keys.every(Boolean) || new Set(keys).size !== 4 || !(answer >= 0 && answer <= 3)) return null;
  return {
    id,
    type: 'mcq',
    difficulty,
    question: { [language]: stem },
    options: Object.fromEntries(LETTERS.map((l, k) => [l, { [language]: options[k] }])),
    answer: LETTERS[answer],
  };
}

/** A bank question's text in `language`, falling back to Uzbek (as create/maktab reads it). */
const bankText = (v: unknown, language: string) => {
  if (typeof v === 'string') return v.trim();
  const loc = (v ?? {}) as Raw;
  return text(loc[language]) || text(loc.uz);
};

/** Gemini with the create routes' request shape. Throws on failure; 'SAFETY' when the topic was refused. */
async function askGemini(apiKey: string, { prompt, temperature }: GeminiPrompt): Promise<unknown[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              q: { type: 'STRING' },
              o: { type: 'ARRAY', items: { type: 'STRING' } },
              a: { type: 'INTEGER' },
              e: { type: 'STRING' },
            },
            required: ['q', 'o', 'a', 'e'],
          },
        },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Gemini request failed');
  const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generated) throw new Error(data.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : 'Empty Gemini answer');
  const items = JSON.parse(generated);
  return Array.isArray(items) ? items : [];
}

export async function POST(req: Request) {
  const match = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) return fail('UNAUTHORIZED', 401);
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1])).uid;
  } catch {
    return fail('UNAUTHORIZED', 401);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail('AI_FAILED', 500);

  let body: Raw;
  try {
    body = await req.json();
  } catch {
    return fail('BAD_INPUT', 400);
  }
  const count = Number(body.count);
  const difficulty = String(body.difficulty);
  const language = String(body.language);
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT || !DIFFICULTIES.includes(difficulty) || !LANGUAGES.includes(language)) {
    return fail('BAD_INPUT', 400);
  }

  const user = await adminDb.collection('users').doc(uid).get();
  if (user.data()?.role !== 'teacher') return fail('FORBIDDEN', 403);

  const permission = await checkUserPermission(uid, null, count);
  if (!permission.allowed) return fail(permission.code === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : 'AI_FAILED', 403);

  const plan = await planFor(body.source, difficulty, language);
  if (!plan) return fail('BAD_INPUT', 400);

  const stamp = Date.now().toString(36);
  const questions: GameQuestion[] = [];

  // 1. Ready questions first (Maktab bank), exactly as create/maktab picks them.
  for (const q of plan.bank) {
    if (questions.length >= count) break;
    const opts = (q.options ?? {}) as Raw;
    const made = playable(
      bankText(q.question, language),
      LETTERS.map((l) => bankText(opts[l], language)),
      LETTERS.indexOf(String(q.answer) as (typeof LETTERS)[number]),
      `bank_${stamp}_${questions.length}`, difficulty, language,
    );
    if (made) questions.push(made);
  }

  // 2. Gemini for the rest, with the create page's prompt.
  const missing = count - questions.length;
  if (missing > 0) {
    try {
      const items = await askGemini(apiKey, plan.prompt(missing));
      for (const it of items) {
        if (questions.length >= count) break;
        const item = (it ?? {}) as Raw;
        const opts = Array.isArray(item.o) ? item.o.map(text) : [];
        const made = playable(text(item.q), opts, Number(item.a), `ai_${stamp}_${questions.length}`, difficulty, language);
        if (made) questions.push(made);
      }
    } catch (error) {
      console.error('Game AI questions error:', error);
      // Bank questions already found are still worth playing.
      if (!questions.length) return fail(error instanceof Error && error.message === 'SAFETY' ? 'BAD_TOPIC' : 'AI_FAILED', 502);
    }
  }

  if (!questions.length) return fail('BAD_TOPIC', 422);

  await deductMonthlyAiCredits(uid, questions.length);
  return NextResponse.json({ questions });
}
