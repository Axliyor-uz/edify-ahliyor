// TEMPORARY — delete after checking. Runs every AI feature on the configured model.
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { generateChat, generateJson } from '@/lib/ai/generate';
import { aiModelFor } from '@/lib/ai/models';
import { fixMath } from '@/lib/ai/fixMath';
import { dtmQuestions, freePromptQuestions, maktabQuestions, MCQ_SCHEMA, type McqItem } from '@/lib/ai/questionPrompts';

export const dynamic = 'force-dynamic';

const valid = (items: McqItem[]) => items.filter((it) => it?.q && Array.isArray(it.o) && it.o.length === 4 && new Set(it.o.map((o) => String(o).trim().toLowerCase())).size === 4 && it.a >= 0 && it.a <= 3);
const bare = (items: McqItem[]) => items.flatMap((it) => [it.q, ...(it.o ?? [])]).filter((s) => fixMath(String(s)) !== String(s)).length;

async function timed<T>(fn: () => Promise<T>) {
  const t = Date.now();
  try { return { ms: Date.now() - t, ...(await fn().then((v) => ({ ms: Date.now() - t, v }))) }; }
  catch (e) { return { ms: Date.now() - t, error: String(e) }; }
}

export async function GET() {
  const out: Record<string, unknown> = { model: aiModelFor('questions') };
  const mcq = async (p: { prompt: string; temperature: number }) => {
    const items = await generateJson<McqItem[]>({ feature: 'questions', ...p, schema: MCQ_SCHEMA });
    return { got: items.length, valid: valid(items).length, bareMath: bare(items), spread: [0, 1, 2, 3].map((k) => items.filter((i) => i.a === k).length).join('/'), sample: items.slice(0, 2).map((i) => i.q + ' | ' + i.o.map((o, k) => (k === i.a ? '[' + o + ']' : o)).join(' · ')) };
  };
  out.topic = await timed(() => mcq(freePromptQuestions({ promptText: "Kasrlarni qo'shish, 6-sinf", difficulty: 'medium', count: 10, language: 'uz' })));
  const syl = JSON.parse(await readFile(process.cwd() + '/data/maktab/6-sinf/matematika/syllabus.json', 'utf8'));
  const sub = syl[0].chapters[0].subtopics[0];
  out.maktab = await timed(() => mcq(maktabQuestions({ topic: '6-sinf', subject: 'matematika', difficulty: 'easy', count: 10, language: 'uz', context: sub.context })));
  out.dtm = await timed(() => mcq(dtmQuestions({ subject: 'Biologiya', topic: 'Hujayra tuzilishi', difficulty: 'hard', count: 10, language: 'uz' })));
  out.ielts = await timed(() => generateJson({ feature: 'ielts', temperature: 0.2, prompt: 'Estimate IELTS Writing bands for this Task 2 answer (about 60 words, minimum 250): "Technology is good. People use phones every day and it help them. But some people use too much. I think technology is more good than bad because it make life easy." Give ta, cc, lr, gra as bands 1-9 and short feedback in uz, ru, en.',
    schema: { type: 'OBJECT', properties: { ta: { type: 'NUMBER' }, cc: { type: 'NUMBER' }, lr: { type: 'NUMBER' }, gra: { type: 'NUMBER' }, feedback: { type: 'OBJECT', properties: { uz: { type: 'STRING' }, ru: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['uz', 'ru', 'en'] } }, required: ['ta', 'cc', 'lr', 'gra', 'feedback'] } }));
  const png = (await readFile('/tmp/claude-1004/-home-matimatik-Documents-Web-Projects-edify-student/f531c39b-2660-4185-b605-cedd8da628a6/scratchpad/test-page.png')).toString('base64');
  out.image = await timed(() => generateJson({ feature: 'images', temperature: 0.1, images: [{ mimeType: 'image/png', data: png }],
    prompt: 'Generate exactly 3 multiple-choice questions based on the educational content of the provided image. Language: uz. If the image is not educational, return {"error":"invalid_image","items":[]}. "q" question, "o" 4 options, "a" correct index, "e" short explanation. Wrap math in $.',
    schema: { type: 'OBJECT', properties: { error: { type: 'STRING' }, items: MCQ_SCHEMA } } }));
  out.chat = await timed(() => generateChat({ feature: 'analytics', system: "You are a mentor to a math teacher. Respond entirely in Uzbek. Under 40 words.", history: [{ role: 'user', parts: [{ text: 'Sinfimda 12 ta oquvchi bor, ortacha ball 64%.' }] }, { role: 'model', parts: [{ text: "Yaxshi boshlanish! 64% — o'rtacha natija." }] }], message: "Ortacha ball nechchi foiz edi?" }));
  return NextResponse.json(out);
}
