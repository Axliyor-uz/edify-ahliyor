'use client';

import { useState } from 'react';
import { Headphones, BookOpen, PenTool, Mic, Crown, ArrowRight, CheckCircle2 } from 'lucide-react';
import { IeltsAssignment, IeltsGroup } from '@/types/ielts';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_ASSIGNMENTS: (Omit<IeltsAssignment, 'skill'> & { skill: 'listening' | 'reading' | 'writing' | 'speaking' | 'mock' })[] = [
  { id: '1', testId: 't1', testTitle: 'Cambridge 16 - Test 1', skill: 'listening', assignedAt: new Date(Date.now() - 86400000 * 3), dueAt: new Date(Date.now() - 86400000 * 2), completedBy: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14'] },
  { id: '2', testId: 't2', testTitle: 'True/False/Not Given Practice', skill: 'reading', assignedAt: new Date(Date.now() - 86400000 * 2), dueAt: new Date(Date.now() - 86400000), completedBy: ['s1', 's2'] },
  { id: '3', testId: 't3', testTitle: 'Task 2: Technology & Society', skill: 'writing', assignedAt: new Date(Date.now() - 86400000), dueAt: new Date(Date.now() + 86400000), completedBy: ['s1', 's2', 's3'] },
  { id: '4', testId: 't4', testTitle: 'Part 2: Describe a recent journey', skill: 'speaking', assignedAt: new Date(Date.now() - 86400000), dueAt: new Date(), completedBy: [] },
  { id: '5', testId: 't5', testTitle: 'Full Mock Exam (End of Month)', skill: 'mock', assignedAt: new Date(Date.now() - 86400000), dueAt: new Date(Date.now() + 86400000 * 5), completedBy: [] },
];

type SkillFilter = 'all' | 'listening' | 'reading' | 'writing' | 'speaking' | 'mock';

const FILTERS: { id: SkillFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'Barchasi', icon: '' },
  { id: 'listening', label: 'Listening', icon: '🎧' },
  { id: 'reading', label: 'Reading', icon: '📖' },
  { id: 'writing', label: 'Writing', icon: '✍️' },
  { id: 'speaking', label: 'Speaking', icon: '🗣️' },
  { id: 'mock', label: 'Full Mock', icon: '👑' },
];

const SKILL_CONFIG = {
  listening: { icon: Headphones, color: 'text-on-primary-container', bg: 'bg-primary-container', border: 'border-transparent' },
  reading: { icon: BookOpen, color: 'text-on-secondary-container', bg: 'bg-secondary-container', border: 'border-transparent' },
  writing: { icon: PenTool, color: 'text-on-tertiary-container', bg: 'bg-tertiary-container', border: 'border-transparent' },
  speaking: { icon: Mic, color: 'text-on-primary-container', bg: 'bg-primary-container', border: 'border-transparent' },
  mock: { icon: Crown, color: 'text-on-tertiary-container', bg: 'bg-tertiary-container', border: 'border-transparent' },
};

interface Props {
  group: IeltsGroup;
}

export default function IeltsUnifiedFeed({ group }: Props) {
  const [filter, setFilter] = useState<SkillFilter>('all');

  const totalStudents = group.studentIds?.length || 18; // Fallback to 18 if empty for mock realism

  const filtered = MOCK_ASSIGNMENTS.filter(a => filter === 'all' || a.skill === filter);

  return (
    <div className="flex flex-col gap-6">

      {/* Horizontal Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`m3-interactive whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-m3-md font-black text-[13px] border transition-all active:scale-95 shrink-0 ${filter === f.id
                ? 'bg-primary text-on-primary border-transparent shadow-elev-1'
                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:border-outline'
              }`}
          >
            {f.icon && <span>{f.icon}</span>}
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Assignment Cards Feed */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map(assignment => {
            const Config = SKILL_CONFIG[assignment.skill];
            const Icon = Config.icon;

            // Format date nicely
            const date = assignment.dueAt as Date;
            const dateStr = date.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });

            const completedCount = assignment.completedBy.length;
            const ratio = `${completedCount} / ${totalStudents}`;
            const isFullyCompleted = completedCount === totalStudents;

            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                key={assignment.id}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 hover:shadow-elev-2 transition-all"
              >

                {/* Left: Icon & Title */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-m3-md border flex items-center justify-center shrink-0 ${Config.bg} ${Config.color} ${Config.border}`}>
                    <Icon size={22} strokeWidth={2.5} />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-[15px] font-black text-on-surface truncate mb-1">
                      {assignment.testTitle}
                    </h4>
                    <p className="text-[13px] font-bold text-on-surface-variant">
                      Topshirish: <span className="text-on-surface">{dateStr}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Ratio & Action */}
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end border-t sm:border-t-0 border-outline-variant pt-3 sm:pt-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm border text-[12px] font-black ${isFullyCompleted ? 'bg-success-container text-on-success-container border-transparent' : 'bg-surface-container-high text-on-surface border-outline-variant'
                    }`}>
                    {isFullyCompleted ? <CheckCircle2 size={14} strokeWidth={3} /> : null}
                    {ratio} topshirdi
                  </div>

                  <button className="m3-interactive flex items-center gap-1.5 px-4 py-2 bg-surface-container-high hover:bg-state-hover text-on-surface rounded-m3-md font-black text-[13px] transition-colors group-hover:bg-primary group-hover:text-on-primary">
                    Ko'rish <ArrowRight size={14} strokeWidth={3} />
                  </button>
                </div>

              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 bg-surface-container-low border-2 border-outline-variant border-dashed rounded-m3-xl">
            <p className="text-[14px] font-bold text-on-surface-variant">Bu bo'limda hozircha topshiriqlar yo'q.</p>
          </div>
        )}
      </div>

    </div>
  );
}
