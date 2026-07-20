'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import {
  Card, Chip, ErrorState, Page, PageHeader, Spinner, Stack, cn,
} from '@/components/student-ui';
import type { Status } from '@/components/student-ui';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// --- BULLETPROOF LATEX PARSER ---
const FormattedText = ({ text }: { text: any }) => {
  if (text === undefined || text === null || text === '') return <span className="text-[13px] italic text-on-surface-variant">Javob berilmagan</span>;
  let content = typeof text === 'string' ? text : JSON.stringify(text);
  const hasMathCommands = /\\frac|\\pi|\\sin|\\cos|\\tan|\\ge|\\le|\\cup|\\cap|\\in|\\begin|\\sqrt|\\empty/.test(content);
  if (!content.includes('$') && hasMathCommands) content = `$${content}$`;
  content = content.replace(/\\\((.*?)\\\)/g, '$$$1$$').replace(/\\\[(.*?)\\\]/g, '$$$$$1$$$$');

  return (
    <span className="inline-block break-words leading-relaxed">
      {content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g).map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          try { return <span key={index} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(2, -2).trim(), { displayMode: true }) }} className="s-scroll my-2 block overflow-x-auto" />; } catch (e) { return <span key={index}>{part}</span>; }
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          try { return <span key={index} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1, -1).trim(), { displayMode: false }) }} className="inline-block px-1" />; } catch (e) { return <span key={index}>{part}</span>; }
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

function ReviewPageContent() {
  const { examId } = useParams() as { examId: string };
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId');
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [examData, setExamData] = useState<any>(null);

  useEffect(() => {
    if (!user || !examId || !classId) return;

    const fetchReviewData = async () => {
      try {
        // 1. Fetch Class Exam Settings (to check if results are hidden)
        const examSnap = await getDoc(doc(db, 'classes', classId, 'exams', examId));
        if (!examSnap.exists()) throw new Error("Imtihon topilmadi.");
        const eData = examSnap.data();
        setExamData(eData);

        if (eData.hideResults) throw new Error("Natijalar o'qituvchi tomonidan yashirilgan.");

        // 2. Fetch Attempt Data safely
        const attemptId = `${user.uid}_${examId}`;
        let attemptSnap = await getDoc(doc(db, 'attempts', attemptId));

        // Fallback query just in case the deterministic ID wasn't used
        if (!attemptSnap.exists()) {
          const q = query(collection(db, 'attempts'), where('classId', '==', classId), where('assignmentId', '==', examId), where('userId', '==', user.uid));
          const qDocs = await getDocs(q);
          if (qDocs.empty) throw new Error("Sizning urinishingiz topilmadi.");
          attemptSnap = qDocs.docs[0] as any;
        }

        const aData = attemptSnap.data();
        if (aData?.status !== 'graded') throw new Error("Imtihon hali to'liq baholanmagan.");
        setAttempt(aData);

        // 3. Fetch Original Test Template safely
        const templateSnap = await getDoc(doc(db, 'bsb_chsb_tests', aData.testId || eData.testId));
        if (!templateSnap.exists()) throw new Error("Test shabloni topilmadi.");
        setTemplate(templateSnap.data());

      } catch (err: any) {
        console.error("🔥 REVIEW FETCH ERROR:", err);
        setError(err.message || "Noma'lum xatolik yuz berdi.");
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [examId, classId, user]);

  if (loading) return (
    <Page width="wide" className="grid min-h-[70vh] place-items-center">
      <Spinner size={34} />
    </Page>
  );

  if (error || !attempt || !template) {
    return (
      <Page width="wide" className="grid min-h-[70vh] place-items-center">
        <ErrorState
          title="Kirish taqiqlangan"
          description={error || "Xatolik yuz berdi."}
          onRetry={() => router.back()}
          retryLabel="Ortga qaytish"
        />
      </Page>
    );
  }

  // --- SAFE RENDERING HELPERS ---
  const renderAnswer = (q: any, ans: any) => {
    if (ans === undefined || ans === null || ans === '') return <span className="text-[13px] italic text-on-surface-variant">Javob berilmagan</span>;
    if (q.type === 'true_false') return <span className="text-[14px] font-bold text-on-surface">{ans ? "Rost" : "Yolg'on"}</span>;
    if (q.type === 'mcq') {
      const optionText = q.options?.[ans]?.uz || q.options?.[ans] || ans;
      return (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-m3-xs border border-outline-variant bg-surface-container-high text-[12px] font-black text-on-surface">{ans}</span>
          <span className="text-[14px] font-bold leading-relaxed text-on-surface md:text-[15px]"><FormattedText text={optionText} /></span>
        </div>
      );
    }
    if (q.type === 'matching' && typeof ans === 'object') {
      return (
        <div className="mt-1 w-full space-y-2">
          {Object.entries(ans).map(([left, right], i) => (
            <div key={i} className="flex flex-col gap-1 rounded-m3-sm border border-outline-variant bg-surface p-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-3 md:text-[14px]">
              <span className="flex-1 font-bold text-on-surface"><FormattedText text={left} /></span>
              <span className="hidden shrink-0 text-outline sm:block">➔</span>
              <span className="flex-1 font-bold text-on-surface-variant"><FormattedText text={String(right)} /></span>
            </div>
          ))}
        </div>
      );
    }
    return <span className="text-[14px] font-bold text-on-surface md:text-[15px]"><FormattedText text={ans} /></span>;
  };

  const renderCorrectAnswer = (q: any) => {
    if (q.type === 'true_false') return <span className="text-[14px] font-bold text-on-surface">{q.answer ? "Rost" : "Yolg'on"}</span>;

    if (q.type === 'mcq') {
      const correctAns = q.answer?.uz || q.answer;
      const optionText = q.options?.[correctAns]?.uz || q.options?.[correctAns] || correctAns;
      return (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-m3-xs border border-success bg-success-container text-[12px] font-black text-on-success-container">
            {correctAns}
          </span>
          <span className="text-[14px] font-bold leading-relaxed text-on-surface md:text-[15px]"><FormattedText text={optionText} /></span>
        </div>
      );
    }

    if (q.type === 'matching') {
      return (
        <div className="mt-1 w-full space-y-2">
          {q.pairs?.map((p: any, i: number) => (
            <div key={i} className="flex flex-col gap-1 rounded-m3-sm border border-outline-variant bg-surface p-2.5 text-[13px] sm:flex-row sm:items-center sm:gap-3 md:text-[14px]">
              <span className="flex-1 font-bold text-on-surface"><FormattedText text={p.left?.uz || p.left} /></span>
              <span className="hidden shrink-0 text-outline sm:block">➔</span>
              <span className="flex-1 font-bold text-success"><FormattedText text={p.right?.uz || p.right} /></span>
            </div>
          ))}
        </div>
      );
    }
    if (q.type === 'open_ended') return <span className="text-[14px] font-bold text-on-surface md:text-[15px]"><FormattedText text={q.rubric?.uz || q.rubric || 'N/A'} /></span>;
    return <span className="text-[14px] font-bold text-on-surface md:text-[15px]"><FormattedText text={q.answer?.uz || q.answer || 'N/A'} /></span>;
  };


  return (
    <Page width="wide" className="selection:bg-primary-container">
      <PageHeader
        title="Natijalar tahlili"
        subtitle={template.title}
        onBack={() => router.back()}
        actions={
          <div className="flex flex-col items-center rounded-m3-sm bg-success-container px-4 py-2 text-on-success-container">
            <span className="text-[9px] font-black uppercase leading-none tracking-[0.12em] md:text-[10px]">To'plangan Ball</span>
            <span className="s-num mt-1 text-[16px] font-black leading-none md:text-[18px]">
              {attempt.teacherScore ?? 0} <span className="text-[14px] opacity-70">/ {attempt.totalPoints ?? template.totalPoints ?? '?'}</span>
            </span>
          </div>
        }
      />

      <Stack>
        {template.questions?.map((q: any, idx: number) => {
          // Safety fallbacks
          const earned = attempt.manualScores?.[q.id] ?? 0;
          const total = q.points ?? 0;
          const isPerfect = earned === total && total > 0;
          const isZero = earned === 0;

          const status: Status = isZero ? 'error' : isPerfect ? 'success' : 'warning';
          const Icon = isZero ? XCircle : isPerfect ? CheckCircle2 : AlertCircle;
          const borderColor = isZero ? 'border-error' : isPerfect ? 'border-success' : 'border-warning';

          return (
            <Card key={q.id} variant="outlined">

              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <span className="s-num rounded-m3-xs bg-inverse-surface px-3 py-1 text-[12px] font-black text-inverse-on-surface">{idx + 1}</span>
                  <Chip className="uppercase tracking-[0.12em]">{q.type?.replace('_', ' ') || 'Savol'}</Chip>
                </div>

                <Chip status={status} size="md" icon={<Icon size={16} strokeWidth={2.5} className="hidden sm:block" />} className="shrink-0">
                  <span className="s-num">{earned} <span className="text-[12px] opacity-70">/ {total}</span></span>
                </Chip>
              </div>

              <h3 className="mb-6 text-[15px] font-bold leading-relaxed text-on-surface md:text-[16px]"><FormattedText text={q.question?.uz || q.question} /></h3>

              <div className="grid gap-3 md:grid-cols-2 md:gap-5">
                <div className={cn('rounded-m3-md border bg-surface-container p-4 md:p-5', borderColor)}>
                  <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Sizning javobingiz</span>
                  <div className="w-full">
                    {renderAnswer(q, attempt.answers?.[q.id])}
                  </div>
                </div>

                <div className="rounded-m3-md border border-outline-variant bg-surface-container p-4 md:p-5">
                  <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.12em] text-primary">
                    {q.type === 'open_ended' ? "O'qituvchi mezoni (Rubric)" : "To'g'ri javob"}
                  </span>
                  <div className="w-full">
                    {/* 🟢 Now properly maps matching pairs and MCQs! */}
                    {renderCorrectAnswer(q)}
                  </div>
                </div>
              </div>

            </Card>
          );
        }) || <p className="text-center text-[14px] font-bold text-on-surface-variant">Savollar mavjud emas.</p>}
      </Stack>
    </Page>
  );
}

export default function StudentReviewWrapper() {
  return (
    <Suspense fallback={
      <Page width="wide" className="grid min-h-[70vh] place-items-center">
        <Spinner size={34} />
      </Page>
    }>
      <ReviewPageContent />
    </Suspense>
  );
}
