"use client";

import { useState, useEffect, useMemo } from "react";
import { UserCheck, Users, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import StaffAttendanceGrid from "@/components/attendance/StaffAttendanceGrid";

export default function StaffAttendancePage() {
  const { user } = useAuth();
  const [centerId, setCenterId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then((p) => { if (p?.centerId) setCenterId(p.centerId); });
  }, [user]);

  const { teachers, isLoading } = useCenterClasses(centerId);

  const staff = useMemo(
    () => teachers
      .map((t) => ({ uid: t.teacherId, name: t.teacherName || t.teacherEmail || "Xodim" }))
      .sort((a, b) => a.name.localeCompare(b.name, "uz", { sensitivity: "base" })),
    [teachers]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="text-brand-600" size={24} /> Xodimlar davomati
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">O&apos;qituvchilar davomati, kelish-ketish va soatlarni belgilang</p>
        </div>
        {!isLoading && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-brand-line rounded-full text-[12px] font-semibold text-slate-600">
            <Users size={14} className="text-slate-400" /> {staff.length} xodim
          </span>
        )}
      </div>

      {!centerId && isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={30} /></div>
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
