'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { CheckCircle2, FileQuestion, Layers, Plus } from 'lucide-react';
import { Button, EmptyState, SearchBar, Skeleton, cn } from '@/components/ui';
import { fetchActiveTeacherTests, type TeacherTestSummary } from '@/services/teacherTestService';
import { analyzeTest, MIN_GAME_QUESTIONS, type TestAnalysis } from '../_lib/questionDeck';
import type { Lang } from '@/types/Math';

const PAGE_SIZE = 12;

export interface PickedTest {
  test: TeacherTestSummary;
  analysis: TestAnalysis;
}

/** The strings the picker needs — every game's i18n provides them. */
export interface PickerText {
  search: string;
  loadMore: string;
  usableOf: (usable: number, total: number) => string;
  notEnough: (min: number) => string;
  noTests: string;
  noTestsHint: string;
  noMatch: string;
  createTest: string;
  loadFailed: string;
}

interface Props {
  uid: string;
  lang: Lang;
  selectedId: string | null;
  onSelect: (picked: PickedTest) => void;
  t: PickerText;
}

export default function TestPicker({ uid, lang, selectedId, onSelect, t }: Props) {
  const router = useRouter();
  const [tests, setTests] = useState<TeacherTestSummary[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let alive = true;
    fetchActiveTeacherTests(uid, PAGE_SIZE)
      .then((res) => {
        if (!alive) return;
        setTests(res.tests);
        setCursor(res.cursor);
        setHasMore(res.hasMore);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [uid]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchActiveTeacherTests(uid, PAGE_SIZE, cursor);
      setTests((prev) => [...prev, ...res.tests]);
      setCursor(res.cursor);
      setHasMore(res.hasMore);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tests
      .filter((x) => !needle || x.title.toLowerCase().includes(needle))
      .map((test) => ({ test, analysis: analyzeTest(test.rawQuestions, lang) }));
  }, [tests, search, lang]);

  if (loading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[68px] rounded-m3-md" />)}
      </div>
    );
  }

  if (failed && !tests.length) {
    return <EmptyState icon={<FileQuestion />} title={t.loadFailed} />;
  }

  if (!tests.length) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title={t.noTests}
        description={t.noTestsHint}
        action={<Button icon={<Plus />} onClick={() => router.push('/teacher/create')}>{t.createTest}</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} />

      {!rows.length && <p className="py-6 text-center text-[13px] font-medium text-on-surface-variant">{t.noMatch}</p>}

      <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 custom-scrollbar">
        {rows.map(({ test, analysis }) => {
          const ok = analysis.usable.length >= MIN_GAME_QUESTIONS;
          const selected = selectedId === test.id;
          return (
            <button
              key={test.id}
              type="button"
              disabled={!ok}
              onClick={() => onSelect({ test, analysis })}
              aria-pressed={selected}
              className={cn(
                'flex w-full items-center gap-3 rounded-m3-md border-2 p-3 text-left transition-colors',
                selected ? 'border-primary bg-t-primary-soft' : 'border-outline-variant bg-surface-container-lowest',
                ok ? 'hover:border-primary' : 'cursor-not-allowed opacity-60',
              )}
            >
              <span className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-m3-sm',
                selected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
              )}>
                {selected ? <CheckCircle2 size={20} /> : <Layers size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px] font-bold text-on-surface">{test.title}</b>
                <small className={cn('block text-[12px] font-semibold', ok ? 'text-on-surface-variant' : 'text-error')}>
                  {ok ? t.usableOf(analysis.usable.length, analysis.total) : `${t.usableOf(analysis.usable.length, analysis.total)} · ${t.notEnough(MIN_GAME_QUESTIONS)}`}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      {hasMore && !search && (
        <Button variant="text" loading={loadingMore} onClick={loadMore} className="self-center">{t.loadMore}</Button>
      )}
    </div>
  );
}
