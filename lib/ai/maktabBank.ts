// 🟢 The REGISTRY of ready banks (loaded into RAM on boot): { "biologiya": ["7-sinf", …], … }
import dbRegistry from "@/data/local_dbs/structure.json";

/**
 * The Maktab local question banks (docs/AI.md): ready questions in Firebase
 * Storage `local_dbs/{subject}/{grade}.json`, matched by the syllabus chapter
 * + subtopic NAMES. Shared by `create/maktab/api` (bank first, Gemini after)
 * and the classroom-games route. Moved verbatim out of the maktab route.
 */

type BankQuestion = Record<string, unknown>;

// 🟢 GLOBAL RAM CACHE
const localDbCache: Record<string, BankQuestion[]> = {};

// 🟢 YOUR FIREBASE BUCKET
const BUCKET_NAME = "scanqr-64512.firebasestorage.app";

const shuffleArray = <T,>(array: T[]) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * The bank's questions for one subtopic, shuffled — or null when there is no
 * bank for this subject + grade, nothing matches, or Storage fails.
 * `safeSubject` / `safeGrade` are lower-cased and trimmed ("biologiya", "7-sinf").
 */
export async function findMaktabBankQuestions(safeSubject: string, safeGrade: string, chapter: string, subtopic: string): Promise<BankQuestion[] | null> {
  const availableGradesForSubject = (dbRegistry as Record<string, string[]>)[safeSubject];
  if (!availableGradesForSubject || !availableGradesForSubject.includes(safeGrade)) return null;

  try {
    const cacheKey = `${safeSubject}_${safeGrade}`;
    let localDatabase = localDbCache[cacheKey];

    if (!localDatabase) {
      const encodedPath = encodeURIComponent(`local_dbs/${safeSubject}/${safeGrade}.json`);
      const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodedPath}?alt=media`;

      const res = await fetch(firebaseUrl);
      if (!res.ok) throw new Error(`Firebase Storage'dan topilmadi: ${res.statusText}`);

      localDatabase = await res.json();
      localDbCache[cacheKey] = localDatabase;
    }

    const matchedQuestions = localDatabase.filter((q) =>
      q.chapter === chapter && q.subtopic === subtopic
    );

    return matchedQuestions.length > 0 ? shuffleArray(matchedQuestions) : null;
  } catch (err) {
    console.error(`Firebase Storage Error for ${safeSubject} ${safeGrade}:`, err);
    return null;
  }
}
