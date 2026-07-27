"use client";

import { useCallback, useMemo, useState } from "react";
import {
  collection, getDocs, limit, orderBy, query, where, type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Check, Database, Layers, Plus, Search } from "lucide-react";

import { db } from "@/lib/firebase";
import LatexRenderer from "@/components/LatexRenderer";
import { getMathTopics } from "@/lib/Mathstructure";
import { fetchMyQuestionsPage } from "@/services/questionBankService";
import { bankQuizItem, teacherQuizItem } from "@/lib/RASCHquiz";
import { Button, Select, cn } from "@/components/ui";
import type { DifficultyId, QuestionDoc } from "@/types/Math";
import type { NormalizedQuestion } from "@/types/question";
import type { RaschQuizItem } from "@/types/TeacherRaschQuiz";

/**
 * The two "select an existing question" tabs of the Rasch builder.
 *
 * Both are ON-DEMAND: nothing is read when the tab mounts, only when the teacher
 * presses the load button, and then exactly one page at a time. That is the same
 * rule the question bank follows (docs/QUESTIONS.md) and the reason opening the
 * builder is free.
 */

const PAGE = 10;

export interface PickerStrings {
  subject: string;
  chapter: string;
  difficulty: string;
  easy: string; medium: string; hard: string;
  load: string;
  loadMore: string;
  loading: string;
  none: string;
  added: string;
  add: string;
  block: string;
  imageOnly: string;
  reads: string;
  full: string;
}

/** One row of either picker — the preview, and the add control. */
function PickRow({
  text, meta, imageUrl, isBlock, blockLabel, picked, disabled, addLabel, addedLabel, onAdd,
}: {
  text: string;
  meta: string;
  imageUrl?: string | null;
  isBlock?: boolean;
  blockLabel?: string;
  picked: boolean;
  disabled: boolean;
  addLabel: string;
  addedLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-m3-md border p-3 transition-colors",
      picked ? "border-success bg-success-container/40" : "border-outline-variant bg-surface-container-lowest",
    )}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-m3-xs bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">
            {meta}
          </span>
          {isBlock && (
            <span className="flex items-center gap-1 rounded-m3-xs bg-primary-container px-2 py-0.5 text-[10px] font-black uppercase text-on-primary-container">
              <Layers size={10} /> {blockLabel}
            </span>
          )}
        </div>
        <div className="line-clamp-2 text-[13px] font-medium text-on-surface">
          <LatexRenderer latex={text} />
        </div>
      </div>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" className="h-14 w-14 flex-none rounded-m3-sm border border-outline-variant object-cover" />
      )}

      <Button
        size="sm"
        variant={picked ? "text" : "tonal"}
        icon={picked ? <Check /> : <Plus />}
        disabled={picked || disabled}
        onClick={onAdd}
        className="flex-none"
      >
        {picked ? addedLabel : addLabel}
      </Button>
    </div>
  );
}

// ─── the national bank (questions1) ──────────────────────────────────────────

const DIFFICULTIES: DifficultyId[] = [1, 2, 3];

/**
 * Picks from `questions1` by chapter and difficulty.
 *
 * ⚠️ The query is exactly `topicId + chapterId + difficultyId` ordered by `rand`
 * — the SAME single composite index the exam sampler rides
 * (firestore.indexes.json). Adding a `subtopicId` equality here, or ordering by
 * anything else, silently demands a second index. The first page starts at a
 * random `rand` threshold so two teachers building a paper on the same chapter
 * do not get the same ten questions; "load more" walks on from there.
 *
 * A document written before `npm run backfill:rand` has no `rand` field and is
 * therefore absent from that index — invisible here, exactly as in the exam.
 */
export function BankPicker({
  t, picked, disabled, onAdd,
}: {
  t: PickerStrings;
  picked: Set<string>;
  disabled: boolean;
  onAdd: (item: RaschQuizItem) => void;
}) {
  const topics = useMemo(() => getMathTopics(), []);
  const [topicId, setTopicId] = useState(topics[0]?.topicId ?? "1");
  const [chapterId, setChapterId] = useState(topics[0]?.chapters[0]?.chapterId ?? "01");
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(2);

  const [rows, setRows] = useState<QuestionDoc[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [reads, setReads] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const chapters = topics.find((tp) => tp.topicId === topicId)?.chapters ?? [];

  const load = useCallback(async (fresh: boolean) => {
    setLoading(true);
    try {
      const after = fresh ? Math.random() : cursor ?? Math.random();
      const snap = await getDocs(query(
        collection(db, "questions1"),
        where("topicId", "==", topicId),
        where("chapterId", "==", chapterId),
        where("difficultyId", "==", difficultyId),
        where("rand", ">=", after),
        orderBy("rand"),
        limit(PAGE),
      ));

      const docs = snap.docs.map((d) => ({ ...(d.data() as QuestionDoc), id: d.id }));
      setReads((n) => (fresh ? snap.size : n + snap.size));
      setRows((prev) => (fresh ? docs : [...prev, ...docs]));
      setCursor(docs.length > 0 ? (docs[docs.length - 1].rand ?? null) : null);
      // Short page ⇒ the window above the threshold is spent. We deliberately do
      // NOT wrap around to the bottom of the range: this is a browsing UI, and a
      // silent wrap would show the teacher questions they already scrolled past.
      setExhausted(docs.length < PAGE);
    } finally {
      setLoading(false);
    }
  }, [topicId, chapterId, difficultyId, cursor]);

  const reset = (fn: () => void) => { fn(); setRows([]); setCursor(null); setExhausted(false); setReads(0); };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t.subject}
          value={topicId}
          onChange={(e) => reset(() => {
            const next = e.target.value;
            setTopicId(next);
            setChapterId(topics.find((tp) => tp.topicId === next)?.chapters[0]?.chapterId ?? "01");
          })}
        >
          {topics.map((tp) => <option key={tp.topicId} value={tp.topicId}>{tp.name}</option>)}
        </Select>

        <Select
          label={t.chapter}
          value={chapterId}
          onChange={(e) => reset(() => setChapterId(e.target.value))}
        >
          {chapters.map((c) => <option key={c.chapterId} value={c.chapterId}>{c.chapterId}. {c.name}</option>)}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{t.difficulty}</span>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => reset(() => setDifficultyId(d))}
            className={cn(
              "m3-interactive rounded-m3-sm px-3 py-1.5 text-[11px] font-bold transition-colors",
              difficultyId === d
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant",
            )}
          >
            {d === 1 ? t.easy : d === 2 ? t.medium : t.hard}
          </button>
        ))}

        <Button size="sm" className="ml-auto" icon={<Search />} loading={loading} onClick={() => load(true)}>
          {t.load}
        </Button>
      </div>

      {reads > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
          <Database size={11} /> {reads} {t.reads}
        </p>
      )}

      {rows.length === 0 && !loading && (
        <p className="py-6 text-center text-[12px] font-medium text-on-surface-variant">{t.none}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((q) => (
          <PickRow
            key={q.id}
            text={q.question?.uz || q.question?.ru || q.question?.en || ""}
            meta={`${q.chapter} · ${q.difficulty}`}
            picked={picked.has(q.id)}
            disabled={disabled}
            addLabel={t.add}
            addedLabel={t.added}
            onAdd={() => onAdd(bankQuizItem(q))}
          />
        ))}
      </div>

      {rows.length > 0 && !exhausted && (
        <Button variant="outlined" loading={loading} onClick={() => load(false)}>{t.loadMore}</Button>
      )}
    </div>
  );
}

// ─── the teacher's own bank (teacher_questions) ──────────────────────────────

/**
 * Picks from the teacher's own `teacher_questions`, newest first.
 *
 * Reuses `fetchMyQuestionsPage`, so it rides the existing `creatorId + createdAt
 * desc` index and normalizes both v1 and legacy documents at the boundary —
 * blocks, images and typed answers all arrive already handled.
 */
export function MyBankPicker({
  t, uid, picked, disabled, onAdd,
}: {
  t: PickerStrings;
  uid: string;
  picked: Set<string>;
  disabled: boolean;
  onAdd: (item: RaschQuizItem) => void;
}) {
  const [rows, setRows] = useState<NormalizedQuestion[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const load = async (fresh: boolean) => {
    setLoading(true);
    try {
      const page = await fetchMyQuestionsPage(uid, PAGE, fresh ? null : cursor);
      setRows((prev) => (fresh ? page.questions : [...prev, ...page.questions]));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setTouched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" icon={<Search />} loading={loading} onClick={() => load(true)} className="self-start">
        {t.load}
      </Button>

      {touched && rows.length === 0 && !loading && (
        <p className="py-6 text-center text-[12px] font-medium text-on-surface-variant">{t.none}</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((q) => (
          <PickRow
            key={q.id}
            text={q.question?.uz || q.question?.ru || q.question?.en || (q.imageUrl ? t.imageOnly : "")}
            meta={`${q.topic || q.subject} · ${q.difficulty}`}
            imageUrl={q.imageUrl}
            isBlock={q.isBlock}
            blockLabel={`${t.block} · ${q.parts.length}`}
            picked={picked.has(q.id)}
            disabled={disabled}
            addLabel={t.add}
            addedLabel={t.added}
            onAdd={() => onAdd(teacherQuizItem(q))}
          />
        ))}
      </div>

      {rows.length > 0 && hasMore && (
        <Button variant="outlined" loading={loading} onClick={() => load(false)}>{t.loadMore}</Button>
      )}
    </div>
  );
}
