import maktabStructure from '@/data/maktab/structure.json';
import ixtisosStructure from '@/data/ixtisoslashtirilgan_maktab/structure.json';
import dtmSyllabus from '@/data/syllabus.json';

/**
 * Where AI game questions come from (docs/GAMES.md → "AI bilan yaratish").
 * Pure data + helpers, shared by the panel and the API route — the route
 * re-validates everything here, never trusting the browser's names or text.
 *
 * - topic:       any topic the teacher types
 * - maktab:      state-school syllabus  (data/maktab/{grade}/{subject}/syllabus.json)
 * - ixtisos:     specialized-school syllabus (data/ixtisoslashtirilgan_maktab/…)
 * - abiturient:  entrance-exam (DTM): AI for a subject + typed topic, or —
 *                for Matematika — ready questions from the DTM bank
 *                (`questions1`, the same picker data as /teacher/create/database)
 *
 * AI sources go to the route; `dtm-bank` is read in the browser, like the
 * create page does, and spends no credits.
 */

export type SourceKind = 'topic' | 'maktab' | 'ixtisos' | 'abiturient';
export type SyllabusKind = 'maktab' | 'ixtisos';

export type AiSource =
  | { kind: 'topic'; topic: string }
  | { kind: SyllabusKind; grade: string; subject: string; chapter: number; topic: number }
  | { kind: 'abiturient'; subject: string; topic: string }
  | { kind: 'dtm-bank'; section: number; chapter: number; topic: number };

export const SOURCE_KINDS: SourceKind[] = ['topic', 'maktab', 'ixtisos', 'abiturient'];

export const TRACKS: Record<SyllabusKind, { folder: string; structure: Record<string, string[]> }> = {
  maktab: { folder: 'maktab', structure: maktabStructure },
  ixtisos: { folder: 'ixtisoslashtirilgan_maktab', structure: ixtisosStructure },
};

/** Entrance-exam subjects — the same list as /teacher/create/ai (ids are the Uzbek names). */
export const EXAM_SUBJECTS = [
  'Matematika', 'Fizika', 'Kimyo', 'Biologiya', 'Ona tili va adabiyot', 'Tarix', 'Geografiya', 'Informatika', 'Huquqshunoslik',
] as const;

/** The one exam subject that has a DTM bank. */
export const DTM_BANK_SUBJECT = 'Matematika';

export const MAX_TOPIC = 400;

/** Grades of a track, in school order ("1-sinf" … "11-sinf"). */
export const gradesOf = (kind: SyllabusKind) =>
  Object.keys(TRACKS[kind].structure).sort((a, b) => parseInt(a) - parseInt(b));

export const subjectsOf = (kind: SyllabusKind, grade: string) => TRACKS[kind].structure[grade] ?? [];

/** Folder name → label: "tabiiy fanlar (Science)" → "Tabiiy fanlar (Science)". */
export const subjectLabel = (folder: string) => folder.charAt(0).toUpperCase() + folder.slice(1);

export interface SyllabusTopic {
  name: string;
  /** Teacher-facing rules for the AI (what to ask, what to avoid); may be empty. */
  context: string;
}

export interface SyllabusChapter {
  name: string;
  topics: SyllabusTopic[];
}

/**
 * Flattens a syllabus.json into chapters. The files are not uniform: an array
 * of categories or one bare category; categories holding `chapters`, or
 * chapters sitting directly in the array; chapters without a name. Topics are
 * addressed by POSITION (chapter i, topic j) — the files' `index` fields repeat.
 */
export function normalizeSyllabus(raw: unknown, fallbackName: string): SyllabusChapter[] {
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const chapters: SyllabusChapter[] = [];
  const addChapter = (ch: Record<string, unknown>) => {
    const topics = (Array.isArray(ch.subtopics) ? ch.subtopics : [])
      .filter((s): s is Record<string, unknown> => !!s && typeof s.name === 'string' && !!s.name.trim())
      .map((s) => ({ name: String(s.name).trim(), context: typeof s.context === 'string' ? s.context : '' }));
    if (topics.length) chapters.push({ name: typeof ch.chapter === 'string' && ch.chapter.trim() ? ch.chapter.trim() : fallbackName, topics });
  };
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    if (Array.isArray(it.chapters)) it.chapters.forEach((ch) => ch && typeof ch === 'object' && addChapter(ch as Record<string, unknown>));
    else if (Array.isArray(it.subtopics)) addChapter(it);
  }
  return chapters;
}

/** True when the request names a grade + subject that exist in that track (blocks path tricks). */
export const isKnownSubject = (kind: SyllabusKind, grade: string, subject: string) =>
  Object.hasOwn(TRACKS[kind].structure, grade) && subjectsOf(kind, grade).includes(subject);

/** The DTM bank's sections (Algebra, Geometriya) with their chapters — positions match `dtmBankIds`. */
export const DTM_SECTIONS = (dtmSyllabus as { category: string; chapters: unknown[] }[]).map((cat) => ({
  name: cat.category,
  chapters: normalizeSyllabus({ chapters: cat.chapters }, cat.category),
}));

/** The `questions1` path ids of a picked bank topic (the files' own `index` values, as create/database uses). */
export function dtmBankIds(section: number, chapter: number, topic: number) {
  const cat = (dtmSyllabus as { index: number; chapters: { index: number; subtopics: { index: number }[] }[] }[])[section];
  const ch = cat?.chapters[chapter];
  const sub = ch?.subtopics[topic];
  return cat && ch && sub ? { subjectId: '01', topicId: cat.index, chapterId: ch.index, subtopicId: sub.index } : null;
}
