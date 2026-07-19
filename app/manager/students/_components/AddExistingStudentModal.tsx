"use client";

/**
 * Manager links an EXISTING student account to the center — class-free (the
 * roster is centerId-anchored via center_students; groups come later). Lookup
 * by email (server-side /api/directory/lookup) or @username (public usernames
 * read). Multi-center: linking here never touches other centers' links.
 */

import { useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { lookupByEmail } from "@/lib/directory";
import { X, Search, User, Loader2, UserPlus, AtSign } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  centerId: string;
  onClose: () => void;
  /** Fired after a successful link so the page can refresh the roster. */
  onAdded?: () => void;
}

interface FoundStudent {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AddExistingStudentModal({ centerId, onClose, onAdded }: Props) {
  const [input, setInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [found, setFound] = useState<FoundStudent | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFound(null);
    const q = input.trim().toLowerCase().replace(/^@/, "");
    if (!q) return;

    setSearching(true);
    try {
      let uid: string;
      if (q.includes("@")) {
        // Email path — server-side lookup (role comes back with it).
        const match = await lookupByEmail(q); // throws on 404
        if (match.role !== "student") throw new Error("Bu hisob o'quvchi emas.");
        uid = match.uid;
      } else {
        // Username path — public usernames doc → users doc.
        const unameSnap = await getDoc(doc(db, "usernames", q));
        if (!unameSnap.exists()) throw new Error("Bunday username topilmadi.");
        uid = unameSnap.data().uid;
      }

      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) throw new Error("Foydalanuvchi topilmadi.");
      const u = userSnap.data();
      if (u.role !== "student") throw new Error("Bu hisob o'quvchi emas.");

      // Already in THIS center? (get on own-center link is always allowed)
      const linkSnap = await getDoc(doc(db, "center_students", `${centerId}_${uid}`));
      if (linkSnap.exists()) throw new Error("Bu o'quvchi markazga allaqachon qo'shilgan.");

      setFound({ uid, displayName: u.displayName || "Noma'lum", username: u.username, photoURL: u.photoURL });
    } catch (err: any) {
      setError(err.message || "Qidirishda xatolik yuz berdi.");
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!found) return;
    setAdding(true);
    try {
      await setDoc(doc(db, "center_students", `${centerId}_${found.uid}`), {
        centerId,
        studentId: found.uid,
        studentName: found.displayName,
        source: "linked",
        addedAt: serverTimestamp(),
      });
      toast.success(`${found.displayName} markazga qo'shildi!`);
      onAdded?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Qo'shishda xatolik yuz berdi.");
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !adding && onClose()}></div>
      <div className="relative bg-white w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 shrink-0">
            <Search size={22} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Mavjud o&apos;quvchini qo&apos;shish</h2>
            <p className="text-[13px] text-slate-500">Email yoki @username orqali toping — guruhsiz ham qo&apos;shiladi.</p>
          </div>
          <button type="button" onClick={() => !adding && onClose()}
            className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full transition-colors shrink-0">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <AtSign size={18} />
            </div>
            <input
              type="text" required value={input} autoFocus
              onChange={(e) => { setInput(e.target.value); setError(""); setFound(null); }}
              disabled={searching || adding}
              placeholder="email yoki @username"
              className="w-full pl-11 pr-24 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60"
            />
            <button type="submit" disabled={searching || adding || !input.trim()}
              className="absolute inset-y-1.5 right-1.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-[13px] rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5">
              {searching ? <Loader2 size={14} className="animate-spin" /> : "Qidirish"}
            </button>
          </div>

          {error && (
            <p className="text-[13px] font-bold text-red-500 px-1 animate-in slide-in-from-top-1">{error}</p>
          )}

          {found && (
            <div className="flex items-center gap-3 p-4 bg-brand-50/60 border border-brand-100 rounded-2xl animate-in fade-in slide-in-from-top-1">
              {found.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={found.photoURL} alt={found.displayName} className="w-11 h-11 rounded-full object-cover border border-white shrink-0" />
              ) : (
                <span className="w-11 h-11 rounded-full bg-brand-100 text-brand-800 font-bold text-[13px] flex items-center justify-center shrink-0">
                  {getInitials(found.displayName)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-slate-900 truncate">{found.displayName}</p>
                {found.username && <p className="text-[12px] text-slate-400 truncate">@{found.username}</p>}
              </div>
              <button type="button" onClick={handleAdd} disabled={adding}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-[13px] rounded-full transition-colors disabled:opacity-60 shadow-sm shadow-brand-600/25">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Qo&apos;shish
              </button>
            </div>
          )}

          {!found && !error && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <User size={18} className="text-slate-300 shrink-0" />
              <p className="text-[12.5px] text-slate-400 font-medium">
                O&apos;quvchi tizimda ro&apos;yxatdan o&apos;tgan bo&apos;lishi kerak. Yangi hisob kerak boʻlsa — &quot;Yangi hisob yaratish&quot;dan foydalaning.
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
