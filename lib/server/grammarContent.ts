// ─── Grammar content for the server (Admin SDK, cached) ─────────────────────
// Reads what scripts/publishGrammar.mjs published (enggrammar_meta / syllabus /
// topics / questions) and builds the ContentView that lib/grammar/session.ts
// grades against. Parsed docs are cached in memory by their content version,
// so a warm instance costs one meta read per submission.

import { adminDb } from '@/lib/firebaseAdmin';
import { parseItems, type GrammarItem } from '@/lib/grammar/grade';
import type { ContentView, TopicView } from '@/lib/grammar/session';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TopicData {
  version: string;
  title: string;
  passScore: number;
  points: { id: string; title: string }[];
  huntIds: Set<string>;
  items: Map<string, GrammarItem>;
}

let syllabusCache: { version: string; topics: TopicView[] } | null = null;
const topicCache = new Map<string, TopicData>();

function safeJson(raw: unknown): any {
  try { return JSON.parse(String(raw ?? '')); } catch { return null; }
}

async function loadTopic(topicId: string, version: string): Promise<TopicData | null> {
  const cached = topicCache.get(topicId);
  if (cached && cached.version === version) return cached;
  const [tSnap, qSnap] = await Promise.all([
    adminDb.collection('enggrammar_topics').doc(topicId).get(),
    adminDb.collection('enggrammar_questions').doc(topicId).get(),
  ]);
  if (!tSnap.exists || !qSnap.exists) return null;
  const topic = safeJson(tSnap.get('topicJson')) || {};
  const games = safeJson(tSnap.get('gamesJson')) || {};
  const data: TopicData = {
    version,
    title: String(topic?.title?.en || topicId),
    passScore: typeof topic.pass_score === 'number' ? topic.pass_score : 0.8,
    points: (Array.isArray(topic.points) ? topic.points : [])
      .filter((p: any) => p && typeof p.id === 'string')
      .sort((a: any, b: any) => (a.index || 0) - (b.index || 0))
      .map((p: any) => ({ id: p.id, title: String(p?.title?.en || p.id) })),
    huntIds: new Set((Array.isArray(games.error_hunter) ? games.error_hunter : []).map((h: any) => String(h?.id))),
    items: parseItems(String(qSnap.get('questionsJson') ?? '')),
  };
  topicCache.set(topicId, data);
  return data;
}

/**
 * The content view for one submission: the syllabus + the topics it touches
 * ([topicIds]) — or, with [wholeLevelOf], every published topic of that
 * lesson's CEFR level (needed to see a sub-level / level completed).
 */
export async function loadGrammarContent(topicIds: string[], wholeLevelOf?: string): Promise<ContentView> {
  const meta = await adminDb.collection('enggrammar_meta').doc('current').get();
  if (!meta.exists) throw new Error('grammar content is not published');
  const versions: Record<string, string> = meta.get('topics') || {};
  const sylVersion = String(meta.get('syllabusVersion') || '');

  if (!syllabusCache || syllabusCache.version !== sylVersion) {
    const syl = safeJson((await adminDb.collection('enggrammar_syllabus').doc('main').get()).get('json')) || {};
    const topics: TopicView[] = (Array.isArray(syl.topics) ? syl.topics : [])
      .filter((t: any) => t && typeof t.id === 'string')
      .sort((a: any, b: any) => (a.index || 0) - (b.index || 0))
      .map((t: any) => ({
        id: t.id, level: String(t.level || ''), sublevel: String(t.sublevel || ''),
        ready: t.status === 'ready' && !!t.folder,
      }));
    syllabusCache = { version: sylVersion, topics };
  }
  const topics = syllabusCache.topics.map((t) => ({ ...t, ready: t.ready && !!versions[t.id] }));

  const level = wholeLevelOf ? topics.find((t) => t.id === wholeLevelOf)?.level : undefined;
  const wanted = new Set(topicIds);
  if (level) topics.filter((t) => t.level === level && t.ready).forEach((t) => wanted.add(t.id));
  const loaded = new Map<string, TopicData>();
  await Promise.all([...wanted].filter((id) => versions[id]).map(async (id) => {
    const d = await loadTopic(id, versions[id]);
    if (d) loaded.set(id, d);
  }));

  return {
    topics,
    items: (id) => loaded.get(id)?.items,
    points: (id) => loaded.get(id)?.points.map((p) => p.id),
    passScore: (id) => loaded.get(id)?.passScore ?? 0.8,
    pointTitle: (id, point) => loaded.get(id)?.points.find((p) => p.id === point)?.title || point,
    topicTitle: (id) => loaded.get(id)?.title || id,
    huntTextExists: (id, textId) => !!loaded.get(id)?.huntIds.has(textId),
  };
}
