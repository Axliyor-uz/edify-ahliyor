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
  listening: { icon: Headphones, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  reading: { icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  writing: { icon: PenTool, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  speaking: { icon: Mic, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  mock: { icon: Crown, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
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
            className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[13px] border-2 transition-all active:scale-95 shrink-0 ${filter === f.id
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200/80 hover:border-slate-300'
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
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border-2 border-slate-200/80 hover:border-slate-300 transition-colors"
              >

                {/* Left: Icon & Title */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 ${Config.bg} ${Config.color} ${Config.border}`}>
                    <Icon size={22} strokeWidth={2.5} />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-[15px] font-black text-slate-900 truncate mb-1">
                      {assignment.testTitle}
                    </h4>
                    <p className="text-[13px] font-bold text-slate-400">
                      Topshirish: <span className="text-slate-600">{dateStr}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Ratio & Action */}
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end border-t-2 sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-[12px] font-black ${isFullyCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200/80'
                    }`}>
                    {isFullyCompleted ? <CheckCircle2 size={14} strokeWidth={3} /> : null}
                    {ratio} topshirdi
                  </div>

                  <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[13px] transition-colors group-hover:bg-slate-900 group-hover:text-white">
                    Ko'rish <ArrowRight size={14} strokeWidth={3} />
                  </button>
                </div>

              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 bg-zinc-50 border-2 border-slate-200/80 border-dashed rounded-2xl">
            <p className="text-[14px] font-bold text-slate-500">Bu bo'limda hozircha topshiriqlar yo'q.</p>
          </div>
        )}
      </div>

    </div>
  );
}
