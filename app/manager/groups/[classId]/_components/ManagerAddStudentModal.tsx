"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, limit, documentId,
} from "firebase/firestore";
import { X, Search, UserPlus, Loader2, ArrowRight, Users } from "lucide-react";
import toast from "react-hot-toast";
import { lookupByEmail } from "@/lib/directory";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import ManagerSheet from "@/app/manager/_components/ManagerSheet";
import { patchStudentFinanceApi } from "@/services/financeService";
import { getTodayKey } from "@/lib/dateUtils";

interface Props {
  classId: string;
  centerId: string;
  existingStudentIds: string[];
  onClose: () => void;
  /** Called after each successful add — the modal stays open for adding more. */
  onAdded: () => void;
}

interface StudentLite {
  uid: string;
  displayName: string;
  username: string;
  email: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ManagerAddStudentModal({ classId, centerId, existingStudentIds, onClose, onAdded }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUid, setAddingUid] = useState<string | null>(null);

  // Students already in other groups of this center — pickable without typing exact usernames.
  const { classes, isLoading: loadingClasses } = useCenterClasses(centerId);
  const [centerStudents, setCenterStudents] = useState<StudentLite[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    if (loadingClasses) return;
    const ids = new Set<string>();
    classes.forEach((c) => (c.studentIds || []).forEach((id) => ids.add(id)));
    existingStudentIds.forEach((id) => ids.delete(id));
    const list = [...ids];

    if (list.length === 0) {
      setCenterStudents([]);
      setLoadingStudents(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snaps = await Promise.all(
          chunk(list, 10).map((part) =>
            getDocs(query(collection(db, "users"), where(documentId(), "in", part)))
          )
        );
        const profiles: StudentLite[] = snaps.flatMap((s) =>
          s.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: data.displayName || "Noma'lum",
              username: data.username || "",
              email: data.email || "",
            };
          })
        );
        profiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (!cancelled) setCenterStudents(profiles);
      } catch (err) {
        console.error("Error loading center students:", err);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();

    return () => { cancelled = true; };
  }, [classes, loadingClasses, existingStudentIds]);

  // Typing filters the center list live; the arrow button does an exact global lookup.
  const visibleCenterStudents = useMemo(() => {
    const q = searchInput.trim().toLowerCase().replace("@", "");
    if (!q) return centerStudents;
    return centerStudents.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
    );
  }, [centerStudents, searchInput]);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setFoundUser(null);

    try {
      const isEmail = searchInput.includes("@") && searchInput.includes(".");

      let uidToFetch = null;

      if (isEmail) {
        // Resolved server-side: `users.email` is no longer client-queryable (contact
        // details are owner-only now — docs/AUTH.md).
        const formattedEmail = searchInput.trim().toLowerCase();
        const match = await lookupByEmail(formattedEmail).catch(() => null);
        if (match) {
          uidToFetch = match.uid;
        }
      } else {
        const cleanName = searchInput.replace("@", "").toLowerCase().trim();
        const usernameRef = doc(db, "usernames", cleanName);
        const usernameSnap = await getDoc(usernameRef);

        if (usernameSnap.exists()) {
          uidToFetch = usernameSnap.data().uid;
        }
      }

      if (uidToFetch) {
        if (existingStudentIds.includes(uidToFetch)) {
          toast.error("Bu o'quvchi allaqachon guruhda.");
          setIsSearching(false);
          return;
        }
        const userSnap = await getDoc(doc(db, "users", uidToFetch));

        if (userSnap.exists()) {
          const userData = userSnap.data();

          if (userData.role !== "student") {
            toast.error("Faqat o'quvchilarni qo'shish mumkin.");
            setIsSearching(false);
            return;
          }

          setFoundUser({ uid: uidToFetch, ...userData });
        } else {
          toast.error("Foydalanuvchi ma'lumotlari topilmadi.");
        }
      } else {
        toast.error("Foydalanuvchi topilmadi.");
      }
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("Qidiruvda xatolik yuz berdi.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddStudent = async (uid: string, displayName: string) => {
    setAddingUid(uid);
    try {
      const classRef = doc(db, "classes", classId);
      await updateDoc(classRef, { studentIds: arrayUnion(uid) });

      // Finance: stamp the join date (drives rolling billing cycles + first-month
      // proration). Best-effort — generation falls back to a full charge if missing.
      patchStudentFinanceApi(uid, { enrollmentDates: { [classId]: getTodayKey() } }).catch(() => {});

      toast.success(`${displayName || "O'quvchi"} qo'shildi!`);
      setFoundUser(null);
      setSearchInput("");
      setCenterStudents((prev) => prev.filter((s) => s.uid !== uid));
      onAdded();
    } catch (error) {
      console.error("Add student failed:", error);
      toast.error("O'quvchini qo'shishda xatolik yuz berdi.");
    } finally {
      setAddingUid(null);
    }
  };

  const hasInput = searchInput.trim().length > 0;
  const isBusy = addingUid !== null;

  return (
    <ManagerSheet onClose={onClose} dismissible={!isBusy}>
      {/* HEADER */}
      <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shrink-0">
            <UserPlus size={19} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">O'quvchi qo'shish</h2>
            <p className="text-xs text-slate-400 font-medium">Ro'yxatdan tanlang yoki qidiring</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          <X size={17} strokeWidth={2.5} />
        </button>
      </div>

      {/* BODY */}
      <div className="p-5 sm:p-7">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors" size={17} />
          <input
            type="text"
            placeholder="Ism, username yoki email..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setFoundUser(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full pl-11 pr-14 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 outline-none transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !hasInput}
            title="Aniq username/email bo'yicha qidirish"
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              hasInput && !isSearching
                ? "bg-brand-600 text-white hover:bg-brand-700 active:scale-95"
                : "bg-slate-100 text-slate-400 border border-slate-200"
            }`}
          >
            {isSearching ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} strokeWidth={2.5} />}
          </button>
        </div>

        {/* Exact search result */}
        {foundUser && (
          <div className="mt-4 bg-brand-25 border border-brand-200 p-3.5 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="w-11 h-11 bg-brand-600 rounded-full flex items-center justify-center font-bold text-white text-base shrink-0">
              {foundUser.displayName?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900 text-sm truncate">{foundUser.displayName || "Noma'lum"}</p>
              <p className="text-xs font-medium text-slate-500 truncate">
                {foundUser.username ? `@${foundUser.username}` : foundUser.email}
              </p>
            </div>
            <button
              onClick={() => handleAddStudent(foundUser.uid, foundUser.displayName)}
              disabled={isBusy}
              className="h-10 px-4 bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-bold rounded-full transition-all disabled:opacity-50 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              {addingUid === foundUser.uid ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
              Qo'shish
            </button>
          </div>
        )}

        {/* Center students */}
        <div className="mt-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users size={13} /> Markaz o'quvchilari
            {!loadingStudents && centerStudents.length > 0 && (
              <span className="text-slate-300 font-semibold normal-case tracking-normal">· {visibleCenterStudents.length}</span>
            )}
          </p>

          {loadingStudents || loadingClasses ? (
            <div className="space-y-2 animate-pulse">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : centerStudents.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
              Boshqa guruhlarda qo'shilmagan o'quvchi yo'q. Yuqoridan qidirib qo'shing.
            </p>
          ) : visibleCenterStudents.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-4 text-center bg-slate-50 rounded-xl">
              Ro'yxatda topilmadi — aniq username/email bilan qidirib ko'ring.
            </p>
          ) : (
            <div className="max-h-[40dvh] overflow-y-auto overscroll-contain -mx-1 px-1 space-y-2">
              {visibleCenterStudents.map((s) => (
                <div key={s.uid} className="flex items-center gap-3 p-3 bg-white border border-brand-line rounded-2xl hover:border-brand-200 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-sm shrink-0">
                    {s.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{s.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{s.username ? `@${s.username}` : s.email}</p>
                  </div>
                  <button
                    onClick={() => handleAddStudent(s.uid, s.displayName)}
                    disabled={isBusy}
                    title="Guruhga qo'shish"
                    className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                  >
                    {addingUid === s.uid ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ManagerSheet>
  );
}
