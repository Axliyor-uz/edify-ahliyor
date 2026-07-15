'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { 
  CheckCircle, XCircle, ChevronLeft, AlertTriangle, 
  BookOpen, Trophy, Lightbulb, List, Eye, Lock, Clock, Grid, Filter
} from 'lucide-react';
import LatexRenderer from '@/components/LatexRenderer';
import QuestionCreator from '@/components/QuestionCreator';
import { Loader2 } from 'lucide-react';
import { useStudentLanguage } from '@/app/(student)/layout';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeQuestions, isAnswerCorrect, hasAnswer, gradeQuestion, isPartCorrect, isBlockAnswer, type BlockAnswer } from '@/lib/questionSchema';
import type { NormalizedPart, NormalizedQuestion } from '@/types/question';

// --- TRANSLATION DICTIONARY ---
const RESULTS_TRANSLATIONS: any = {
  uz: {
    loading: "Natijalar yuklanmoqda...", back: "Sinfga qaytish", title: "Natijalar",
    status: { excellent: "Ajoyib Natija!", good: "Yaxshi Harakat", needsWork: "Yaxshilash Kerak" },
    cards: { score: "Ball", right: "To'g'ri", wrong: "Noto'g'ri", questions: "Savollar", review: "Batafsil Ko'rib Chiqish", overview: "Xarita", filters: "Filtr", all: "Barchasi", incorrectOnly: "Faqat Xatolar" },
    question: { skipped: "O'tkazil.", yourAns: "Sizning javob", noSel: "Tanlanmadi", correctAns: "To'g'ri Javob", showOpts: "Variantlar", hideOpts: "Yashirish", viewExp: "Yechim", hideExp: "Yashirish", solution: "Yechim", options: "Barcha Variantlar" },
    block: { parts: "Savol qismlari", points: "ball" },
    blocked: { title: "Ball Saqlandi", result: "Sizning Natijangiz", reason1: "O'qituvchi batafsil ko'rib chiqishni yopgan.", reason2: "Natijalar yashirin: ", btn: "Panelga qaytish" }
  },
  en: {
    loading: "Loading Results...", back: "Back to Class", title: "Results",
    status: { excellent: "Excellent Work!", good: "Good Effort", needsWork: "Needs Improvement" },
    cards: { score: "Score", right: "Right", wrong: "Wrong", questions: "Questions", review: "Review", overview: "Map", filters: "Filters", all: "All", incorrectOnly: "Incorrect Only" },
    question: { skipped: "Skipped", yourAns: "Your Answer", noSel: "None", correctAns: "Correct Answer", showOpts: "Options", hideOpts: "Hide", viewExp: "Solution", hideExp: "Hide", solution: "Step-by-Step Solution", options: "All Options" },
    block: { parts: "Sub-questions", points: "pts" },
    blocked: { title: "Score Recorded", result: "Your Result", reason1: "Review is disabled by the instructor.", reason2: "Results hidden until: ", btn: "Return to Dashboard" }
  },
  ru: {
    loading: "Загрузка...", back: "В класс", title: "Результаты",
    status: { excellent: "Отлично!", good: "Хорошо", needsWork: "Нужно улучшить" },
    cards: { score: "Балл", right: "Верно", wrong: "Неверно", questions: "Вопросы", review: "Обзор", overview: "Карта", filters: "Фильтр", all: "Все", incorrectOnly: "Только ошибки" },
    question: { skipped: "Пропуск", yourAns: "Ваш ответ", noSel: "Нет", correctAns: "Правильный", showOpts: "Варианты", hideOpts: "Скрыть", viewExp: "Решение", hideExp: "Скрыть", solution: "Пошаговое решение", options: "Все варианты" },
    block: { parts: "Подвопросы", points: "балл" },
    blocked: { title: "Балл сохранен", result: "Результат", reason1: "Обзор отключен.", reason2: "Скрыто до: ", btn: "На панель" }
  }
};

// Questions are normalized (lib/questionSchema.ts), so every text field is a
// {uz,ru,en} object — never dump the object itself into the UI: an image-only
// option, and an empty explanation, legitimately carry no text.
const getContentText = (content: any) => {
  if (!content) return "";
  if (typeof content === 'string') return content;
  return content.uz || content.en || content.ru || content.text || "";
};

// An option can carry an image (normalized: `options[letter].imageUrl`), with or
// without text.
const OptionImage = ({ url, alt }: { url?: string | null; alt?: string }) =>
  url ? <img src={url} alt={alt || 'Option'} className="mt-1.5 max-h-24 w-auto rounded-lg border border-zinc-200 bg-white object-contain" /> : null;

// One picked/correct option: letter badge + its text + its image. Used for mcq
// (one line) and multiple_select (one line per letter).
const OptionLine = ({ question, optionKey, tone }: { question: any; optionKey: string; tone: 'ok' | 'bad' }) => (
  <div className="flex gap-2 items-start">
    <span className={`w-6 h-6 rounded flex items-center justify-center font-black text-[12px] shrink-0 border ${tone === 'ok' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
      {optionKey?.toUpperCase()}
    </span>
    <div className="text-zinc-800 font-bold text-[13px] pt-0.5">
      <LatexRenderer latex={getContentText(question.options?.[optionKey])} />
      <OptionImage url={question.options?.[optionKey]?.imageUrl} alt={optionKey} />
    </div>
  </div>
);

// A BLOCK's answer is ONE entry in attempts.answers[qId]: `{ [partId]: value }`.
// It counts as answered as soon as any part is; normal questions keep `hasAnswer`.
const isQuestionAnswered = (q: NormalizedQuestion, given: unknown): boolean => {
  if (q.isBlock) {
    if (!isBlockAnswer(given)) return false;
    return q.parts.some((p) => hasAnswer(given[p.id]));
  }
  return hasAnswer(given as string | string[] | undefined);
};

const toKeys = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);
const toText = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v ?? ''));

// One sub-question of a block: its label, its prompt, what the student put, what was
// right, and a ✓/✗ from `isPartCorrect` (the same comparator the runner graded with).
const PartReviewRow = ({ part, given, t }: {
  part: NormalizedPart;
  given: string | string[] | undefined;
  t: { question: { yourAns: string; skipped: string; noSel: string; correctAns: string } };
}) => {
  const ok = isPartCorrect(part, given ?? null);
  const answered = hasAnswer(given ?? null);
  const isTyped = part.optionList.length === 0;

  const chosen = toKeys(given);
  const correct = toKeys(part.correctAnswer?.value);
  const optionText = (key: string) => getContentText(part.optionList.find((o) => o.id === key)?.text);

  return (
    <div className={`rounded-xl border p-3 flex items-start gap-2.5 ${ok ? 'bg-emerald-50/30 border-emerald-100' : answered ? 'bg-rose-50/30 border-rose-100' : 'bg-zinc-50 border-zinc-100'}`}>
      <span className={`w-6 h-6 shrink-0 rounded flex items-center justify-center font-black text-[12px] border ${ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : answered ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-zinc-200 text-zinc-600 border-zinc-200'}`}>
        {part.id}
      </span>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="text-zinc-800 font-bold text-[13px] leading-relaxed break-words">
          <LatexRenderer latex={getContentText(part.prompt)} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-bold">
          <span className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
              {answered ? t.question.yourAns : t.question.skipped}
            </span>
            {answered ? (
              <span className={`font-black break-words ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isTyped ? toText(given) : chosen.map((k) => `${k}${optionText(k) ? `. ${optionText(k)}` : ''}`).join(', ')}
              </span>
            ) : (
              <span className="text-zinc-400 italic">{t.question.noSel}</span>
            )}
          </span>

          {!ok && (
            <span className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{t.question.correctAns}</span>
              <span className="font-black text-emerald-700 break-words">
                {isTyped
                  ? toText(part.correctAnswer?.value)
                  : correct.map((k) => `${k}${optionText(k) ? `. ${optionText(k)}` : ''}`).join(', ')}
              </span>
            </span>
          )}
        </div>

        {getContentText(part.explanation) && (
          <div className="text-zinc-500 font-bold text-[12px] leading-relaxed pt-0.5 break-words">
            <LatexRenderer latex={getContentText(part.explanation)} />
          </div>
        )}
      </div>

      <div className="shrink-0 pt-0.5">
        {ok ? <CheckCircle className="text-emerald-500" strokeWidth={2.5} size={16} /> : <XCircle className="text-rose-500" strokeWidth={2.5} size={16} />}
      </div>
    </div>
  );
};

// ==================================================================================
// COMPONENT: Question Card (Compact & Sleek Scale)
// ==================================================================================
const QuestionReviewCard = ({ question, index, studentAnswerKey, t }: any) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);

  const questionText = getContentText(question.question);
  // After normalization `explanation` is ALWAYS a {uz,ru,en} object (truthy even when
  // blank), so read the text first, then fall back to the legacy `solution` field that
  // only ever existed on the raw source doc.
  const explanationText = getContentText(question.explanation) || getContentText(question.raw?.solution);

  // Same comparator the runner graded with (lib/questionSchema.ts) — mcq letter,
  // multiple_select set, typed open/numeric text, or a BLOCK (correct only when every
  // part is). Never re-implement it here.
  const isCorrect = isAnswerCorrect(question, studentAnswerKey);
  const isSkipped = !isQuestionAnswered(question, studentAnswerKey);

  // A BLOCK gets PARTIAL credit — show what it actually earned out of its parts' points.
  const isBlock = !!question.isBlock;
  const blockAnswer: BlockAnswer = isBlockAnswer(studentAnswerKey) ? studentAnswerKey : {};
  const { earned, total } = gradeQuestion(question, studentAnswerKey);

  const isTyped = !isBlock && (question.optionList?.length ?? 0) === 0;   // open / numeric / fill_blank
  const correctValue = question.correctAnswer?.value;
  const correctKeys: string[] = Array.isArray(correctValue) ? correctValue : question.answer ? [question.answer] : [];
  const correctKeySet = new Set(correctKeys);
  const chosenKeys: string[] = Array.isArray(studentAnswerKey) ? studentAnswerKey : studentAnswerKey ? [studentAnswerKey] : [];
  const typedAnswer = Array.isArray(studentAnswerKey) ? studentAnswerKey.join(', ') : String(studentAnswerKey ?? '');
  const typedCorrect = Array.isArray(correctValue) ? correctValue.join(', ') : String(correctValue ?? question.answer ?? '');
  const acceptedAnswers: string[] = question.correctAnswer?.acceptedAnswers || [];

  const borderColor = isCorrect ? 'border-emerald-200' : isSkipped ? 'border-zinc-200' : 'border-rose-200';
  const headerBg = isCorrect ? 'bg-emerald-50/50' : isSkipped ? 'bg-zinc-50' : 'bg-rose-50/50';
  const badgeColor = isCorrect ? 'bg-emerald-500 text-white' : isSkipped ? 'bg-zinc-200 text-zinc-600' : 'bg-rose-500 text-white';

  return (
    <div id={`question-${index}`} className={`bg-white rounded-2xl border ${borderColor} shadow-sm overflow-hidden scroll-mt-24`}>
      {/* HEADER */}
      <div className={`px-4 py-3 flex items-start gap-3 border-b ${borderColor} ${headerBg}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-[13px] shadow-sm ${badgeColor}`}>
          {index + 1}
        </div>
        <div className="flex-1 pt-0.5">
          <div className="font-bold text-zinc-800 text-[14px] leading-relaxed">
            <LatexRenderer latex={questionText} />
          </div>
          {question.imageUrl && (
            <img src={question.imageUrl} alt="" className="mt-2.5 max-h-60 w-auto rounded-xl border border-zinc-200 bg-white object-contain" />
          )}
          <QuestionCreator creatorName={question.creatorName} correctedBy={question.correctedBy} className="mt-2 text-zinc-400" />
        </div>
        <div className="shrink-0 pt-0.5 flex items-center gap-2">
          {isBlock && (
            <span className={`px-2 py-1 rounded-lg text-[11px] font-black border ${isCorrect ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : earned > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
              {earned}/{total} {t.block.points}
            </span>
          )}
          {isCorrect ? <CheckCircle className="text-emerald-500" strokeWidth={2.5} size={20} /> :
           isSkipped ? <AlertTriangle className="text-zinc-400" strokeWidth={2.5} size={20} /> :
           <XCircle className="text-rose-500" strokeWidth={2.5} size={20} />}
        </div>
      </div>

      {/* BODY */}
      <div className="p-4">
        {/* A BLOCK reviews part by part: prompt, what the student put, what was right, ✓/✗. */}
        {isBlock && (
          <div className="mb-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.block.parts}</p>
            {question.parts.map((part: NormalizedPart) => (
              <PartReviewRow key={part.id} part={part} given={blockAnswer[part.id]} t={t} />
            ))}
          </div>
        )}

        {!isBlock && (
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          {/* Student Answer */}
          <div className={`rounded-xl p-3 border flex flex-col gap-1.5 ${isCorrect ? 'bg-emerald-50/30 border-emerald-100' : isSkipped ? 'bg-zinc-50 border-zinc-100' : 'bg-rose-50/30 border-rose-100'}`}>
             <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isCorrect ? 'text-emerald-600' : isSkipped ? 'text-zinc-500' : 'text-rose-600'}`}>
               {isCorrect ? <CheckCircle size={12} strokeWidth={3}/> : isSkipped ? <AlertTriangle size={12} strokeWidth={3}/> : <XCircle size={12} strokeWidth={3}/>}
               {isSkipped ? t.question.skipped : t.question.yourAns}
             </span>
             <div className="mt-0.5">
                {isSkipped ? (
                   <span className="text-zinc-400 italic text-[13px] font-bold">{t.question.noSel}</span>
                ) : isTyped ? (
                   // open / numeric — the student typed this, there is no letter to show.
                   <p className={`text-[13px] font-black break-words ${isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>{typedAnswer}</p>
                ) : (
                   <div className="flex flex-col gap-1.5">
                     {chosenKeys.map((k) => <OptionLine key={k} question={question} optionKey={k} tone={isCorrect ? 'ok' : 'bad'} />)}
                   </div>
                )}
             </div>
          </div>

          {/* Correct Answer (If wrong) */}
          {!isCorrect && (
            <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-3 flex flex-col gap-1.5">
               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                 <CheckCircle size={12} strokeWidth={3} /> {t.question.correctAns}
               </span>
               <div className="mt-0.5">
                  {isTyped ? (
                    <>
                      <p className="text-[13px] font-black text-emerald-800 break-words">{typedCorrect}</p>
                      {acceptedAnswers.length > 0 && (
                        <p className="text-[11px] font-bold text-emerald-600/70 mt-1 break-words">≈ {acceptedAnswers.join(' · ')}</p>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {correctKeys.map((k) => <OptionLine key={k} question={question} optionKey={k} tone="ok" />)}
                    </div>
                  )}
               </div>
            </div>
          )}
        </div>
        )}

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100">
          {!isTyped && !isBlock && (
            <button onClick={() => setShowAllOptions(!showAllOptions)} className="flex items-center gap-1.5 text-zinc-500 text-[11px] font-black uppercase tracking-widest bg-white border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors">
              {showAllOptions ? <Eye size={14} strokeWidth={2.5}/> : <List size={14} strokeWidth={2.5}/>} {showAllOptions ? t.question.hideOpts : t.question.showOpts}
            </button>
          )}

          {explanationText && (
            <button onClick={() => setShowExplanation(!showExplanation)} className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${showExplanation ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}>
              <Lightbulb size={14} strokeWidth={2.5} className="text-indigo-500" /> {showExplanation ? t.question.hideExp : t.question.viewExp}
            </button>
          )}
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {showAllOptions && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="space-y-1.5">
                  {Object.entries(question.options || {}).map(([key, val]: any) => (
                    // multiple_select has several correct letters — highlight them all.
                    <div key={key} className={`flex items-start gap-2 p-2 rounded-lg border ${correctKeySet.has(key) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-zinc-200'}`}>
                      <span className={`w-6 h-6 flex items-center justify-center font-black text-[11px] rounded shrink-0 ${correctKeySet.has(key) ? 'bg-emerald-200 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}`}>{key}</span>
                      <div className="text-[13px] font-bold text-zinc-700 pt-0.5">
                        <LatexRenderer latex={getContentText(val)} />
                        <OptionImage url={val?.imageUrl} alt={key} />
                      </div>
                      {correctKeySet.has(key) && <CheckCircle size={14} strokeWidth={3} className="text-emerald-500 ml-auto shrink-0 mt-0.5"/>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {showExplanation && explanationText && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-3">
                 <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0"><Lightbulb size={14} strokeWidth={3}/></div>
                 <div className="space-y-1 w-full pt-1">
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{t.question.solution}</p>
                    <div className="text-zinc-800 font-bold text-[13px] leading-relaxed"><LatexRenderer latex={explanationText} /></div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

// ==================================================================================
// MAIN PAGE COMPONENT
// ==================================================================================
export default function TestResultsPage() {
  const { classId, assignmentId } = useParams() as { classId: string; assignmentId: string };
  const { user } = useAuth();
  const router = useRouter();
  const { lang } = useStudentLanguage();
  const t = RESULTS_TRANSLATIONS[lang] || RESULTS_TRANSLATIONS['en'];

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<any>(null);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [assignment, setAssignment] = useState<any>(null);

  const [canViewDetails, setCanViewDetails] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');
  
  // 🟢 NEW: Filter State
  const [filter, setFilter] = useState<'all' | 'incorrect'>('all');

  useEffect(() => {
    if (!user) return;
    async function loadResults() {
      try {
        const attemptsQ = query(collection(db, 'attempts'), where('assignmentId', '==', assignmentId), where('userId', '==', user!.uid));
        const attemptSnap = await getDocs(attemptsQ);
        if (attemptSnap.empty) { router.push(`/classes/${classId}`); return; }
        const attemptDoc = attemptSnap.docs[0].data();
        setAttempt(attemptDoc);

        const testSnap = await getDoc(doc(db, 'custom_tests', attemptDoc.testId));
        if (testSnap.exists()) {
          const test = testSnap.data();
          setTestData(test);
          // 🟢 THE ONLY PLACE questions enter this page. custom_tests.questions[] holds
          // frozen snapshots in BOTH shapes (legacy letter-map + canonical v1 array).
          // Normalizing once here keeps every line below reading the legacy shape:
          // `options[letter]`, `answer` as a letter (which is what attempts store).
          setQuestions(normalizeQuestions(test.questions, lang));
        }

        const assignSnap = await getDoc(doc(db, 'classes', classId, 'assignments', assignmentId));
        if (assignSnap.exists()) setAssignment(assignSnap.data());

      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    }
    loadResults();
  }, [user, assignmentId, classId, router, lang]);

  useEffect(() => {
    if (!testData || !assignment) return;
    const visibility = testData.resultsVisibility || (testData.showResults ? 'always' : 'never');

    if (visibility === 'always') setCanViewDetails(true);
    else if (visibility === 'never') { setCanViewDetails(false); setBlockReason(t.blocked.reason1); }
    else if (visibility === 'after_due') {
      if (!assignment.dueAt) setCanViewDetails(true); 
      else {
        const now = new Date();
        const dueDate = new Date(assignment.dueAt.seconds * 1000);
        if (now > dueDate) setCanViewDetails(true);
        else {
          setCanViewDetails(false);
          setBlockReason(`${t.blocked.reason2} ${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`);
        }
      }
    }
  }, [testData, assignment, t]);

  // 🟢 SMART MAP SCROLLING
  const handleMapClick = (idx: number, qId: string) => {
    const isCorrect = isAnswerCorrect(questions[idx], attempt.answers?.[qId]);
    
    // If they click a correct answer while filtering only incorrects, auto-switch filter back to 'All'
    if (filter === 'incorrect' && isCorrect) {
      setFilter('all');
      setTimeout(() => {
        const el = document.getElementById(`question-${idx}`);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      }, 100); 
    } else {
      const el = document.getElementById(`question-${idx}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-zinc-50 text-indigo-600 gap-3 font-black text-xl"><Loader2 className="animate-spin" size={32}/> {t.loading}</div>;
  if (!attempt || !testData) return null;

  if (!canViewDetails) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full p-8 bg-white rounded-[2rem] shadow-xl border border-zinc-200 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={28} strokeWidth={2.5}/></div>
          <h1 className="text-2xl font-black text-zinc-900 mb-2">{t.blocked.title}</h1>
          <div className="mt-6 p-6 bg-zinc-50 rounded-2xl border border-zinc-200">
             <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t.blocked.result}</p>
             <p className="text-5xl font-black text-indigo-600 tracking-tight">{attempt.score}<span className="text-2xl text-zinc-300">/{attempt.totalQuestions}</span></p>
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-700 text-[13px] font-bold flex items-start gap-3 text-left">
             <Clock size={18} strokeWidth={2.5} className="shrink-0 mt-0.5 text-amber-500" />
             <p>{blockReason}</p>
          </div>
          <button onClick={() => router.push(`/classes/${classId}`)} className="mt-8 w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black text-[14px] uppercase tracking-widest rounded-xl transition-all">{t.blocked.btn}</button>
        </div>
      </div>
    );
  }

  const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);
  const gradeColor = percentage >= 80 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-rose-600';
  
  // Apply Filter. A block is filtered as ONE question and counts as correct only when
  // fully correct (`isAnswerCorrect`), so the chips below count QUESTIONS — while
  // attempt.score / attempt.totalQuestions are POINTS (identical numbers unless a block
  // took partial credit).
  const filteredQuestions = questions.filter((q) => filter === 'all' || !isAnswerCorrect(q, attempt.answers?.[q.id]));
  const questionCount = questions.length || attempt.totalQuestions;
  const wrongCount = questions.filter((q) => !isAnswerCorrect(q, attempt.answers?.[q.id])).length;

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 font-sans">
      
      {/* 🟢 MINIMAL STICKY HEADER */}
      <div className="bg-white/90 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.push(`/classes/${classId}`)} className="flex items-center gap-1.5 text-[13px] font-black uppercase tracking-widest text-zinc-500 hover:text-indigo-600 transition-colors">
            <ChevronLeft size={16} strokeWidth={3} /> <span className="hidden sm:inline">{t.back}</span>
          </button>
          <h1 className="font-black text-zinc-900 text-[15px] md:text-[16px] truncate max-w-xs md:max-w-md mx-4">{testData.title}</h1>
          <div className={`font-black text-[15px] flex items-center gap-1.5 ${gradeColor}`}>
            <Trophy size={16} strokeWidth={3} /> {percentage}%
          </div>
        </div>
      </div>

      {/* 🟢 TWO-COLUMN DASHBOARD LAYOUT */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col-reverse lg:flex-row gap-6 md:gap-8">
        
        {/* LEFT COLUMN: Questions (flex-1) */}
        <div className="flex-1 space-y-4">
          
          {/* Quick Filters */}
          <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-zinc-200 shadow-sm">
            <div className="flex gap-1">
              <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-[12px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                {t.cards.all} ({questionCount})
              </button>
              <button onClick={() => setFilter('incorrect')} className={`px-4 py-2 rounded-lg text-[12px] font-black uppercase tracking-widest transition-all ${filter === 'incorrect' ? 'bg-rose-500 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100'}`}>
                {t.cards.incorrectOnly} ({wrongCount})
              </button>
            </div>
            <Filter size={16} className="text-zinc-400 mr-2" strokeWidth={2.5}/>
          </div>

          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              // We need the ORIGINAL index for numbering and scrolling
              const originalIndex = questions.findIndex((origQ) => origQ.id === q.id);
              return (
                <QuestionReviewCard key={q.id} question={q} index={originalIndex} studentAnswerKey={attempt.answers?.[q.id]} t={t} />
              );
            })}
            
            {filteredQuestions.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200">
                 <CheckCircle size={32} className="mx-auto text-emerald-400 mb-3" strokeWidth={2.5}/>
                 <p className="text-zinc-500 font-bold text-[14px]">Perfect score! No incorrect questions.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Sidebar (Stats + Map) */}
        <div className="w-full lg:w-[320px] shrink-0">
          <div className="lg:sticky lg:top-24 flex flex-col sm:flex-row lg:flex-col gap-4 md:gap-6">
            
            {/* COMPACT STATS CARD */}
            <div className="flex-1 lg:flex-none bg-white p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col justify-center">
               <h3 className="font-black text-zinc-800 text-[14px] uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Trophy size={16} strokeWidth={3} className="text-indigo-500"/> {t.cards.score}
               </h3>
               <div className="flex items-end gap-2 mb-4">
                 <span className="text-5xl font-black text-zinc-900 tracking-tighter leading-none">{attempt.score}</span>
                 <span className="text-lg font-bold text-zinc-400 mb-1">/ {attempt.totalQuestions}</span>
               </div>
               
               <div className="flex gap-2">
                 <div className="flex-1 bg-emerald-50 rounded-xl border border-emerald-100 p-2.5 text-center">
                   <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest">{t.cards.right}</p>
                   <p className="font-black text-emerald-700 text-lg">{attempt.score}</p>
                 </div>
                 <div className="flex-1 bg-rose-50 rounded-xl border border-rose-100 p-2.5 text-center">
                   <p className="text-[10px] font-black text-rose-600/70 uppercase tracking-widest">{t.cards.wrong}</p>
                   <p className="font-black text-rose-700 text-lg">{attempt.totalQuestions - attempt.score}</p>
                 </div>
               </div>
            </div>

            {/* OVERVIEW MATRIX (MAP) */}
            <div className="flex-1 lg:flex-none bg-white p-5 md:p-6 rounded-2xl border border-zinc-200 shadow-sm">
               <h3 className="font-black text-zinc-800 text-[14px] uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Grid size={16} strokeWidth={3} className="text-indigo-500"/> {t.cards.overview}
               </h3>
               <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {questions.map((q, idx: number) => {
                     // A block is "correct" only when every part is — `isAnswerCorrect` already does that.
                     const isCorrect = isAnswerCorrect(q, attempt.answers?.[q.id]);
                     const isSkipped = !isQuestionAnswered(q, attempt.answers?.[q.id]);
                     
                     let style = "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200";
                     if (isCorrect) style = "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200";
                     else if (isSkipped) style = "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200";

                     // Dim the correct ones if filter is active, but keep them clickable
                     const isDimmed = filter === 'incorrect' && isCorrect;

                     return (
                       <button 
                         key={idx} 
                         onClick={() => handleMapClick(idx, q.id)}
                         className={`w-8 h-8 md:w-[38px] md:h-[38px] rounded-[10px] font-black text-[12px] md:text-[13px] border transition-all flex items-center justify-center shadow-sm hover:-translate-y-0.5 active:scale-95 ${style} ${isDimmed ? 'opacity-30 hover:opacity-100' : ''}`}
                       >
                         {idx + 1}
                       </button>
                     )
                  })}
               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}