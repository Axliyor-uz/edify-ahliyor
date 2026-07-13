'use client';

import { useTeacherLanguage } from '@/app/teacher/layout';
import { Target, Activity, AlertCircle, CheckCircle2, ChevronRight, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import { IeltsGroup } from '@/types/ielts';

interface Props {
  group: IeltsGroup;
}

const T: Record<string, any> = {
  uz: {
    triageTitle: "Shoshilinch (Needs Attention)",
    triageAction1: "3 ta Writing Task 2 inshosi tekshirishni kutyapti",
    triageBtn1: "Tekshirish",
    triageAction2: "Sardorbek oxirgi 2 ta vazifani topshirmadi",
    triageBtn2: "Ogohlantirish",
    activityTitle: "So'nggi Faollik",
    speedTitle: "Guruh O'zlashtirishi (Avg Band)",
    deltaLabel: "Maqsaddan farq",
  },
  en: {
    triageTitle: "Needs Attention",
    triageAction1: "3 Writing Task 2 essays await grading",
    triageBtn1: "Grade Now",
    triageAction2: "Sardorbek missed the last 2 assignments",
    triageBtn2: "Warn",
    activityTitle: "Recent Activity",
    speedTitle: "Group Performance (Avg Band)",
    deltaLabel: "Delta from Target",
  },
  ru: {
    triageTitle: "Требует Внимания",
    triageAction1: "3 эссе Writing Task 2 ожидают проверки",
    triageBtn1: "Проверить",
    triageAction2: "Sardorbek пропустил последние 2 задания",
    triageBtn2: "Предупредить",
    activityTitle: "Последняя Активность",
    speedTitle: "Успеваемость Группы (Avg Band)",
    deltaLabel: "Отклонение от цели",
  }
};

export default function IeltsPulseDashboard({ group }: Props) {
  const { lang } = useTeacherLanguage();
  const t = T[lang] || T['uz'];

  // Mocked group average logic
  const targetBand = Number(group.targetBand) || 7.0;
  const currentGroupAvg = 6.4; // Mocked
  const delta = currentGroupAvg - targetBand;
  
  let deltaColor = 'bg-success-container text-on-success-container';
  let deltaText = `+${delta.toFixed(1)}`;
  if (delta <= -0.5) {
    deltaColor = 'bg-error-container text-on-error-container';
    deltaText = delta.toFixed(1);
  } else if (delta < 0) {
    deltaColor = 'bg-warning-container text-on-warning-container';
    deltaText = delta.toFixed(1);
  } else {
    deltaText = `+${delta.toFixed(1)}`;
  }

  const activities = [
    { id: 1, text: "Jahongir Reading Test #2 ni yakunladi - Band 7.0", time: "14 daqiqa oldin", icon: CheckCircle2, color: "text-success" },
    { id: 2, text: "Malika Writing Task 1 inshosini yubordi", time: "2 soat oldin", icon: BookOpen, color: "text-primary" },
    { id: 3, text: "Yangi Mock test barchaga tayinlandi", time: "Kecha, 18:00", icon: Target, color: "text-tertiary" },
  ];

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Grid: Speedometer & Triage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Speedometer Delta Card */}
        <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-m3-md bg-primary-container border border-transparent flex items-center justify-center text-on-primary-container mb-4">
            <Activity size={28} strokeWidth={2.5} />
          </div>
          <h3 className="text-[15px] font-black text-on-surface mb-1">{t.speedTitle}</h3>

          <div className="flex items-end gap-3 mt-4 mb-3">
            <span className="text-5xl font-black text-on-surface tracking-tighter leading-none [font-variant-numeric:tabular-nums]">{currentGroupAvg.toFixed(1)}</span>
            <span className="text-sm font-bold text-on-surface-variant mb-1">/ {targetBand.toFixed(1)}</span>
          </div>

          <div className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm border border-transparent font-black text-[13px] ${deltaColor}`}>
             <Target size={14} strokeWidth={3} />
             <span>{deltaText} {t.deltaLabel}</span>
          </div>
        </div>

        {/* Red Alert Triage Box */}
        <div className="bg-error-container rounded-m3-lg border-2 border-error shadow-elev-1 p-6 flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-error" />

          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle size={20} className="text-on-error-container" strokeWidth={2.5} />
            <h3 className="text-[16px] font-black text-on-error-container">{t.triageTitle}</h3>
          </div>

          <div className="flex flex-col gap-3">
            {/* Triage Item 1 */}
            <div className="bg-surface-container-lowest border-2 border-outline-variant rounded-m3-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-elev-1">
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-error mt-1.5 shrink-0 animate-pulse" />
                <p className="text-[13.5px] font-bold text-on-surface leading-snug">{t.triageAction1}</p>
              </div>
              <button className="m3-interactive px-4 py-2 bg-error text-on-error rounded-m3-md font-black text-[12px] transition-colors shrink-0 active:scale-95 shadow-elev-1">
                {t.triageBtn1}
              </button>
            </div>

            {/* Triage Item 2 */}
            <div className="bg-surface-container-lowest border-2 border-outline-variant rounded-m3-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-elev-1">
              <div className="flex items-start gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-warning mt-1.5 shrink-0" />
                <p className="text-[13.5px] font-bold text-on-surface leading-snug">{t.triageAction2}</p>
              </div>
              <button className="m3-interactive px-4 py-2 bg-warning-container text-on-warning-container rounded-m3-md font-black text-[12px] transition-colors shrink-0 active:scale-95 border-2 border-transparent">
                {t.triageBtn2}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Activity Ticker */}
      <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 p-6 flex flex-col">
        <h3 className="text-[15px] font-black text-on-surface mb-5">{t.activityTitle}</h3>
        <div className="flex flex-col gap-4 relative">
          {/* Vertical line connector */}
          <div className="absolute left-[15px] top-4 bottom-4 w-px bg-outline-variant z-0" />

          {activities.map((act) => (
            <div key={act.id} className="relative z-10 flex items-start gap-4">
              <div className="w-8 h-8 rounded-m3-md bg-surface-container-lowest border border-outline-variant flex items-center justify-center shrink-0">
                <act.icon size={14} strokeWidth={3} className={act.color} />
              </div>
              <div className="flex-1 min-w-0 pt-1.5">
                <p className="text-[14px] font-bold text-on-surface truncate">{act.text}</p>
                <div className="flex items-center gap-1 text-[11px] font-black text-on-surface-variant mt-1">
                  <Clock size={10} strokeWidth={2.5} />
                  <span>{act.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
