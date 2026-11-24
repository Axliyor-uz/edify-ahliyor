"use client";

/**
 * FUTURE MAP — a soft, static guide from "what you study now" to the
 * university courses four majors (Software Engineer, AI Engineer, Data
 * Scientist, Cyber Security) actually build on, in order.
 *
 * Purely informational: no Firestore read/write, content lives in
 * ./_components/data.ts. See docs/STUDENT.md "Future map".
 *
 * Visual-first by design: each step leads with its subject-category icon and
 * two small tags (when + what kind) — the one-sentence "why" is a tap away,
 * not printed on the card, so the roadmap reads as a map, not an essay.
 */

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

import { useStudentLanguage } from "../layout";
import {
  CATEGORY_META, MAJORS, STAGE_LABELS, STAGE_STATUS, type Category, type Major,
} from "./_components/data";
import {
  Banner, Card, Chip, Page, PageHeader, Tabs, Tile, cn,
} from "@/components/student-ui";
import type { LangType } from "../layout";

const TR = {
  uz: {
    title: "Kelajak xaritasi",
    subtitle: "Qaysi mutaxassislik qaysi fanlarga tayanadi — tartibi bilan.",
    disclaimer: "Umumiy yo'nalish — universitetga qarab fanlar tartibi biroz farq qilishi mumkin.",
    stepsLabel: "bosqich",
  },
  en: {
    title: "Future Map",
    subtitle: "Which subjects each career path depends on — in order.",
    disclaimer: "A general guide — course order can vary a bit by university.",
    stepsLabel: "steps",
  },
  ru: {
    title: "Карта будущего",
    subtitle: "Какие предметы нужны для каждой профессии — и в каком порядке.",
    disclaimer: "Общий ориентир — порядок предметов может отличаться в разных вузах.",
    stepsLabel: "этапов",
  },
} as const;

const CATEGORY_TONE: Record<Category, "primary" | "secondary" | "tertiary" | "gold" | "success" | "error" | "neutral"> = {
  math: "primary",
  programming: "secondary",
  data: "success",
  systems: "neutral",
  security: "error",
  ai: "gold",
};

function CategoryTag({ category, lang }: { category: Category; lang: LangType }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-black",
        meta.style,
      )}
    >
      <Icon size={12} strokeWidth={3} />
      {meta.label[lang] ?? meta.label.uz}
    </span>
  );
}

export default function FutureMapPage() {
  const { lang } = useStudentLanguage();
  const t = TR[lang] ?? TR.uz;
  const [activeId, setActiveId] = useState<string>(MAJORS[0].id);
  const [expanded, setExpanded] = useState<string | null>(null);
  const active: Major = MAJORS.find((m) => m.id === activeId) ?? MAJORS[0];

  return (
    <Page>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <PageHeader title={t.title} subtitle={t.subtitle} />

        <Banner status="neutral" icon={<Info size={16} />} title={t.disclaimer} />

        <Tabs
          label={t.title}
          value={activeId}
          onChange={(id) => { setActiveId(id); setExpanded(null); }}
          tabs={MAJORS.map((m) => ({ value: m.id, label: m.name[lang] ?? m.name.uz, icon: <m.icon size={15} /> }))}
        />

        <Card className="flex items-center gap-3.5">
          <Tile tone={active.tone} size="lg">
            <active.icon size={22} strokeWidth={2.2} />
          </Tile>
          <div className="min-w-0 flex-1">
            <h2 className="s-display text-[16.5px] font-bold leading-tight">{active.name[lang] ?? active.name.uz}</h2>
            <p className="mt-0.5 text-[12.5px] font-bold text-on-surface-variant">{active.tagline[lang] ?? active.tagline.uz}</p>
          </div>
          <Chip status="neutral">{active.steps.length} {t.stepsLabel}</Chip>
        </Card>

        <div className="relative flex flex-col pt-1">
          {active.steps.map((step, i) => {
            const last = i === active.steps.length - 1;
            const open = expanded === `${active.id}-${step.id}`;
            const stageLabel = STAGE_LABELS[step.stage][lang] ?? STAGE_LABELS[step.stage].uz;
            const stageStatus = STAGE_STATUS[step.stage];
            const categoryTone = CATEGORY_TONE[step.category];
            const CategoryIcon = CATEGORY_META[step.category].icon;
            return (
              <div key={`${active.id}-${step.id}`} className={cn("relative flex gap-3.5", !last && "pb-4")}>
                {!last && (
                  <span
                    aria-hidden
                    className="absolute left-[27px] top-14 bottom-0 border-l-2 border-dashed border-outline-variant"
                  />
                )}
                <div className="relative z-10 shrink-0">
                  <Tile tone={categoryTone} size="lg">
                    <CategoryIcon size={22} strokeWidth={2.2} />
                  </Tile>
                  <span className="s-num absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-surface text-[10px] font-black text-on-surface-variant shadow-elev-1">
                    {i + 1}
                  </span>
                </div>

                <Card flush className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : `${active.id}-${step.id}`)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-2 p-3.5 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip status={stageStatus} size="sm">{stageLabel}</Chip>
                        <CategoryTag category={step.category} lang={lang} />
                      </div>
                      <h3 className="mt-1.5 text-[14.5px] font-black leading-snug text-on-surface">
                        {step.title[lang] ?? step.title.uz}
                      </h3>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn("mt-1 shrink-0 text-on-surface-variant transition-transform", open && "rotate-180")}
                    />
                  </button>
                  {open && (
                    <p className="px-3.5 pb-3.5 text-[12.5px] font-medium leading-snug text-on-surface-variant">
                      {step.desc[lang] ?? step.desc.uz}
                    </p>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
