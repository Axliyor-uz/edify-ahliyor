"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, GraduationCap, Layers, Users, Wallet, LogOut, Menu, X,
  BookOpen, CalendarCheck, UserCheck, DoorOpen, CalendarRange, Loader2, Building2,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import ApprovalGate, { type CenterApprovalStatus } from "./_components/ApprovalGate";

// Flat menu — no section headers (they read as noise). Related items are
// grouped visually with hairline dividers instead.
const NAV_GROUPS: { name: string; href: string; icon: React.ElementType }[][] = [
  [{ name: "Boshqaruv paneli", href: "/manager/dashboard", icon: LayoutDashboard }],
  [
    { name: "Guruhlar", href: "/manager/groups", icon: Layers },
    { name: "O'quvchilar", href: "/manager/students", icon: Users },
    { name: "O'qituvchilar", href: "/manager/teachers", icon: GraduationCap },
  ],
  [
    { name: "Davomat", href: "/manager/attendance", icon: CalendarCheck },
    { name: "Xodimlar davomati", href: "/manager/staff-attendance", icon: UserCheck },
  ],
  [
    { name: "Dars jadvali", href: "/manager/timetable", icon: CalendarRange },
    { name: "Xonalar", href: "/manager/rooms", icon: DoorOpen },
  ],
  [{ name: "To'lovlar", href: "/manager/finance", icon: Wallet }],
];

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Proper top-level component (was previously created during render — lint error).
function Sidebar({
  pathname, centerName, userName, userEmail, userPhoto, onNavigate, onLogout,
}: {
  pathname: string | null;
  centerName: string;
  userName: string;
  userEmail: string;
  userPhoto: string | null;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand + center */}
      <div className="px-4 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-sm shadow-amber-500/30 shrink-0">
            <BookOpen size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-[17px] tracking-tight leading-tight">Edify</p>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 truncate">
              <Building2 size={11} className="shrink-0" /> {centerName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <div className="h-px bg-slate-100 mx-2 my-2" />}
            <div className="flex flex-col gap-0.5">
              {group.map((link) => {
                const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-all active:scale-[0.98] ${
                      isActive
                        ? "bg-amber-50 text-amber-800 font-bold"
                        : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-amber-500" />}
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-amber-600" : "text-slate-400"} />
                    <span className="truncate">{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User card + logout */}
      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-2xl hover:bg-slate-50 transition-colors">
          <Link href="/manager/profile" onClick={onNavigate} title="Profilim" className="flex items-center gap-2.5 min-w-0 flex-1">
            {userPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhoto} alt={userName || "Menejer"} className="w-10 h-10 rounded-full object-cover shrink-0 border border-amber-100" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-800 font-bold text-[13px] shrink-0">
                {getInitials(userName)}
              </div>
            )}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-bold text-slate-900 truncate">{userName || "Menejer"}</span>
              <span className="text-[11px] text-slate-400 truncate">{userEmail}</span>
            </div>
          </Link>
          <button
            onClick={onLogout}
            title="Tizimdan chiqish"
            className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <LogOut size={17} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [centerName, setCenterName] = useState("Markaz");
  // Approval gate: writes are blocked by Firestore rules until the center is
  // 'active'; this drives the matching UX. Unknown/missing status → 'pending'.
  const [centerStatus, setCenterStatus] = useState<CenterApprovalStatus>("pending");

  // Logout confirmation dialog
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function checkRole() {
      if (!loading) {
        if (!user) router.push('/auth/login');
        else {
          try {
            const profile = await getUserProfile(user.uid);
            if (profile?.role === 'manager') {
              setUserName(profile.displayName || "");
              setUserPhoto(profile.photoURL || null);
              // Resolve center name + approval status BEFORE rendering children,
              // so gated pages never flash as usable. Any failure → 'pending'.
              if (profile.centerId) {
                try {
                  const snap = await getDoc(doc(db, "centers", profile.centerId));
                  if (snap.exists()) {
                    const data = snap.data();
                    setCenterName(data.name || "Markaz");
                    setCenterStatus(
                      data.status === 'active' ? 'active'
                      : data.status === 'suspended' ? 'suspended'
                      : 'pending'
                    );
                  }
                } catch { /* stays 'pending' */ }
              }
              setIsAuthorized(true);
            }
            else if (profile?.role === 'teacher') router.push('/teacher/dashboard');
            else router.push('/dashboard');
          } catch (error) {
            // Fail closed: an unreadable profile must not grant access.
            console.error(error);
            router.push('/auth/login');
          }
        }
      }
    }
    checkRole();
  }, [user, loading, router]);

  // Keep the sidebar avatar/name in sync — e.g. right after the manager
  // uploads a photo on /manager/profile — without needing a full reload.
  useEffect(() => {
    if (!isAuthorized || !user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setUserName(data.displayName || "");
      setUserPhoto(data.photoURL || null);
    }, () => { /* keep last known values on error */ });
    return () => unsub();
  }, [isAuthorized, user]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobileMenuOpen]);

  // Esc closes drawer / logout dialog.
  useEffect(() => {
    if (!isMobileMenuOpen && !logoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsMobileMenuOpen(false); if (!isLoggingOut) setLogoutOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileMenuOpen, logoutOpen, isLoggingOut]);

  if (loading || (user && !isAuthorized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-page">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-sm animate-pulse">
          <BookOpen size={24} />
        </div>
      </div>
    );
  }

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch {
      toast.error("Tizimdan chiqishda xatolik yuz berdi");
      setIsLoggingOut(false);
    }
  };

  const requestLogout = () => { setIsMobileMenuOpen(false); setLogoutOpen(true); };

  return (
    <div className="min-h-[100dvh] bg-brand-page flex font-['Inter',sans-serif] selection:bg-amber-100 selection:text-amber-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-40">
        <Sidebar
          pathname={pathname}
          centerName={centerName}
          userName={userName}
          userEmail={user?.email || ""}
          userPhoto={userPhoto}
          onNavigate={() => {}}
          onLogout={requestLogout}
        />
      </aside>

      {/* Mobile Header — menu button on the LEFT (the drawer slides in from the left) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200 z-40 flex items-center justify-between px-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Menyuni ochish"
            className="w-10 h-10 shrink-0 flex items-center justify-center bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 text-slate-900 min-w-0">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shrink-0">
              <BookOpen size={15} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-[15px] tracking-tight leading-tight">Edify</p>
              <p className="text-[10px] font-semibold text-slate-400 truncate leading-tight">{centerName}</p>
            </div>
          </div>
        </div>
        {/* Identity chip on the right → manager profile */}
        <Link href="/manager/profile" title="Profilim" className="shrink-0 active:scale-95 transition-transform">
          {userPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userPhoto} alt={userName || "Menejer"} className="w-9 h-9 rounded-full object-cover border border-amber-100" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-800 font-bold text-[12px]">
              {getInitials(userName)}
            </div>
          )}
        </Link>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-[290px] max-w-[85%] h-full bg-white shadow-2xl rounded-r-3xl overflow-hidden animate-[drawerIn_.2s_ease-out]">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Yopish"
              className="absolute top-4 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={19} />
            </button>
            <Sidebar
              pathname={pathname}
              centerName={centerName}
              userName={userName}
              userEmail={user?.email || ""}
              userPhoto={userPhoto}
              onNavigate={() => setIsMobileMenuOpen(false)}
              onLogout={requestLogout}
            />
          </div>
        </div>
      )}

      {/* Logout confirmation dialog */}
      {logoutOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => !isLoggingOut && setLogoutOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 text-center shadow-2xl animate-[dialogIn_.18s_ease-out]">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-4">
              <LogOut size={26} strokeWidth={2.25} />
            </div>
            <h3 className="text-[17px] font-black text-slate-900 tracking-tight">Tizimdan chiqish</h3>
            <p className="text-[13.5px] text-slate-500 font-medium mt-1.5 mb-6">
              Rostdan ham hisobingizdan chiqmoqchimisiz?
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setLogoutOpen(false)}
                disabled={isLoggingOut}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13.5px] rounded-xl transition-colors disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold text-[13.5px] rounded-xl shadow-sm shadow-red-500/25 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={15} />}
                {isLoggingOut ? "Chiqilmoqda..." : "Chiqish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col pt-14 lg:pt-0 overflow-y-auto">
        <div
          className={
            // Attendance + finance use the full width (wide grids/tables need the room);
            // every other manager page keeps the centered, max-width layout.
            pathname?.startsWith("/manager/attendance") || pathname?.startsWith("/manager/staff-attendance") || pathname?.startsWith("/manager/timetable") || pathname?.startsWith("/manager/finance")
              ? "flex-1 w-full p-3 sm:p-4 lg:p-6"
              : "flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8"
          }
        >
          <ApprovalGate status={centerStatus}>{children}</ApprovalGate>
        </div>
      </main>

      <style jsx global>{`
        @keyframes drawerIn { from { transform: translateX(-24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes dialogIn { from { transform: translateY(16px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}
