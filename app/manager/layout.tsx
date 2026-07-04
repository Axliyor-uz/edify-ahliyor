"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, GraduationCap, Layers, Users, Wallet, LogOut, Menu, X, BookOpen, ChevronDown, CalendarCheck } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";

const NAV_LINKS = [
  { name: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
  { name: "O'qituvchilar", href: "/manager/teachers", icon: GraduationCap },
  { name: "Guruhlar", href: "/manager/groups", icon: Layers },
  { name: "O'quvchilar", href: "/manager/students", icon: Users },
  { name: "Davomat", href: "/manager/attendance", icon: CalendarCheck },
  { name: "Moliya", href: "/manager/finance", icon: Wallet },
];

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth() as any;
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    async function checkRole() {
      if (!loading) {
        if (!user) router.push('/auth/login');
        else {
          try {
            const profile = await getUserProfile(user.uid);
            if (profile?.role === 'student' || !profile?.role) router.push('/dashboard');
            else if (profile?.role === 'teacher') router.push('/teacher/dashboard');
            else setIsAuthorized(true);
          } catch (error) {
            console.error(error);
            setIsAuthorized(true);
          }
        }
      }
    }
    checkRole();
  }, [user, loading, router]);

  if (loading || (user && !isAuthorized)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-sm animate-pulse">
          <BookOpen size={24} />
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      toast.error("Tizimdan chiqishda xatolik yuz berdi");
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Top Brand Section */}
      <div className="p-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2.5 text-slate-900 mb-4">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
            <BookOpen size={18} strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-[19px] tracking-tight">Edify Manager</span>
        </div>
        
        {/* Branch Selector */}
        <div className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filial</span>
            <span className="text-[13px] font-bold text-slate-800">Everest Academy</span>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      {/* Middle Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 custom-scrollbar">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          const Icon = link.icon;
          return (
            <Link 
              key={link.name} 
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-[14px] transition-all ${
                isActive 
                  ? "bg-amber-50 text-amber-700 shadow-sm" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? "text-amber-600" : "text-slate-400"} />
              {link.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Session Section */}
      <div className="p-4 border-t border-slate-100 shrink-0 space-y-3 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold border border-amber-200 shrink-0 shadow-sm">
            MR
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-[14px] font-bold text-slate-900 truncate">Manager 1</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest bg-slate-200/50 px-1.5 py-0.5 rounded w-max mt-0.5">Director</span>
          </div>
        </div>
        
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors group"
        >
          <LogOut size={16} strokeWidth={2.5} className="text-slate-400 group-hover:text-red-500 transition-colors" />
          Chiqish
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex font-['Inter',sans-serif] selection:bg-amber-100 selection:text-amber-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 shrink-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Header & Overlay */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-slate-900">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center text-white shrink-0">
            <BookOpen size={14} strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-[16px] tracking-tight">Manager</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -mr-2 bg-slate-50 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[80%] h-full bg-white animate-in slide-in-from-left duration-200 shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col pt-16 lg:pt-0 overflow-y-auto">
        <div
          className={
            // Attendance uses the full width (its wide grid needs the room);
            // every other manager page keeps the centered, max-width layout.
            pathname?.startsWith("/manager/attendance")
              ? "flex-1 w-full p-3 sm:p-4 lg:p-5"
              : "flex-1 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8"
          }
        >
          {children}
        </div>
      </main>
    </div>
  );
}
