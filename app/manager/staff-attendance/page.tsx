"use client";

import { useState, useEffect, useMemo } from "react";
import { UserCheck, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import StaffAttendanceGrid from "@/components/attendance/StaffAttendanceGrid";
import { useManagerLanguage } from "@/app/manager/_components/ManagerLanguage";

const TRANSLATIONS = {
  uz: {
    title: "Xodimlar davomati",
    subtitle: "O'qituvchilar davomati, kelish-ketish va soatlarni belgilang",
    staffFallback: "Xodim",
    staffCount: (n: number) => `${n} xodim`,
  },
  en: {
    title: "Staff attendance",
    subtitle: "Track teachers' attendance, check-in/out and hours",
    staffFallback: "Staff member",
    staffCount: (n: number) => `${n} staff`,
  },
  ru: {
    title: "Посещаемость сотрудников",
    subtitle: "Отмечайте посещаемость, приход-уход и часы учителей",
    staffFallback: "Сотрудник",
    staffCount: (n: number) => `${n} сотрудников`,
  },
};
type PageT = typeof TRANSLATIONS.uz;

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const { lang } = useManagerLanguage();
  const t: PageT = TRANSLATIONS[lang];
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { teachers, isLoading } = useCenterClasses(centerId);

  const staff = useMemo(
    () => teachers
      .map((tch) => ({ uid: tch.teacherId, name: tch.teacherName || tch.teacherEmail || t.staffFallback }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz", { sensitivity: "base" })),
    [teachers, t]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
            <UserCheck className="text-primary" size={24} /> {t.title}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{t.subtitle}</p>
        </div>
        {!isLoading && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[12px] font-semibold text-on-surface-variant">
            <Users size={14} className="text-on-surface-variant" /> {t.staffCount(staff.length)}
          </span>
        )}
      </div>

      {!centerId && isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-on-surface-variant" size={30} /></div>
      ) : (
        <StaffAttendanceGrid
          centerId={centerId || ""}
          managerId={user?.uid || ""}
          staff={staff}
          loadingStaff={isLoading}
        />
      )}
    </div>
  );
}
