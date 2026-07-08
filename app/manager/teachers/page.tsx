"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Mail, User, Loader2, Phone, BadgeCheck, Layers, Users, BookOpen, ArrowRight } from "lucide-react";
import { collection, query, where, getDocs, getDoc, setDoc, deleteDoc, doc, onSnapshot, serverTimestamp, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
import { useCenterClasses } from "@/hooks/useCenterClasses";
import toast from "react-hot-toast";
import ManagerTeacherInfoPanel from "./_components/ManagerTeacherInfoPanel";

interface CenterTeacher {
  id?: string;
  centerId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  addedAt: any;
}

/** Extra profile fields hydrated from `users/{uid}` for the card view. */
interface TeacherProfile {
  photoURL?: string;
  phone?: string;
  subject?: string;
  experience?: number;
  verifiedTeacher?: boolean;
}

// Deterministic tonal gradient for teachers without a photo.
const AVATAR_TINTS = [
  "from-indigo-100 to-indigo-200 text-indigo-700",
  "from-violet-100 to-violet-200 text-violet-700",
  "from-teal-100 to-teal-200 text-teal-700",
  "from-amber-100 to-amber-200 text-amber-700",
  "from-rose-100 to-rose-200 text-rose-700",
  "from-sky-100 to-sky-200 text-sky-700",
  "from-emerald-100 to-emerald-200 text-emerald-700",
];
function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TeachersPage() {
  const { user } = useAuth() as any;
  const [centerId, setCenterId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<CenterTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal state
  const [emailInput, setEmailInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  // Info modal state
  const [viewingTeacher, setViewingTeacher] = useState<CenterTeacher | null>(null);
  
  // Delete modal state
  const [teacherToDelete, setTeacherToDelete] = useState<CenterTeacher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Hydrated profile fields (photo, phone, subject...) keyed by teacher uid.
  const [profiles, setProfiles] = useState<Record<string, TeacherProfile>>({});

  // Center classes → per-teacher group/student counts for the cards.
  const { classes } = useCenterClasses(centerId);
  const teacherStats = useMemo(() => {
    const m = new Map<string, { groups: number; students: number }>();
    for (const c of classes) {
      const cur = m.get(c.teacherId) || { groups: 0, students: 0 };
      cur.groups += 1;
      cur.students += c.studentIds?.length || 0;
      m.set(c.teacherId, cur);
    }
    return m;
  }, [classes]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch manager's centerId
    getUserProfile(user.uid).then(profile => {
      if (profile?.centerId) {
        setCenterId(profile.centerId);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error("Error fetching profile:", err);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!centerId) return;

    // Listen to center_teachers collection
    const q = query(
      collection(db, "center_teachers"),
      where("centerId", "==", centerId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: CenterTeacher[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as CenterTeacher);
      });
      // Sort by addedAt if available
      results.sort((a, b) => {
         const timeA = a.addedAt?.toMillis ? a.addedAt.toMillis() : Date.now();
         const timeB = b.addedAt?.toMillis ? b.addedAt.toMillis() : Date.now();
         return timeB - timeA;
      });
      setTeachers(results);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teachers:", error);
      toast.error("O'qituvchilarni yuklashda xatolik yuz berdi.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [centerId]);

  // Hydrate photo/phone/subject from `users/{uid}` for every listed teacher.
  useEffect(() => {
    if (teachers.length === 0) return;
    let mounted = true;
    (async () => {
      try {
        const snaps = await Promise.all(teachers.map((t) => getDoc(doc(db, "users", t.teacherId))));
        if (!mounted) return;
        const map: Record<string, TeacherProfile> = {};
        snaps.forEach((s, i) => {
          if (!s.exists()) return;
          const d = s.data();
          map[teachers[i].teacherId] = {
            photoURL: d.photoURL,
            phone: d.phone,
            subject: d.subject,
            experience: d.experience,
            verifiedTeacher: d.verifiedTeacher,
          };
        });
        setProfiles(map);
      } catch (err) {
        console.error("Teacher profile hydration error:", err);
      }
    })();
    return () => { mounted = false; };
  }, [teachers]);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) {
        setModalError("Markaz ma'lumotlari topilmadi.");
        return;
    }
    
    setModalError("");
    setIsSubmitting(true);
    
    try {
      const formattedEmail = emailInput.trim().toLowerCase();
      
      // 1. Query users collection
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef, where("email", "==", formattedEmail), limit(1));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        throw new Error("Bu email tizimda topilmadi.");
      }
      
      const foundUserDoc = userSnapshot.docs[0];
      const foundUserData = foundUserDoc.data();
      const foundUserUid = foundUserDoc.id;
      
      // 2. Validation 1 (Role)
      if (foundUserData.role !== "teacher") {
        throw new Error("Bu foydalanuvchi o'qituvchi emas.");
      }
      
      // 3. Membership check (doc ID = teacher uid, so one center per teacher).
      // Never silently overwrite another center's membership.
      const ctDocRef = doc(db, "center_teachers", foundUserUid);
      const existingMembership = await getDoc(ctDocRef);

      if (existingMembership.exists()) {
        if (existingMembership.data().centerId === centerId) {
          throw new Error("Bu o'qituvchi markazga allaqachon qo'shilgan.");
        }
        throw new Error("Bu o'qituvchi boshqa markazga biriktirilgan. Avval u markazdan chiqarilishi kerak.");
      }
      
      // 4. The Write
      await setDoc(ctDocRef, {
        centerId: centerId,
        teacherId: foundUserUid,
        teacherName: foundUserData.displayName || "Noma'lum O'qituvchi",
        teacherEmail: foundUserData.email,
        addedAt: serverTimestamp()
      });
      
      // Success
      toast.success("O'qituvchi muvaffaqiyatli qo'shildi!");
      setIsModalOpen(false);
      setEmailInput("");
      
    } catch (error: any) {
      console.error("Add Teacher Error:", error);
      setModalError(error.message || "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteTeacher = async () => {
    if (!teacherToDelete || !teacherToDelete.id) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "center_teachers", teacherToDelete.id));
      toast.success("O'qituvchi o'chirildi.");
      setTeacherToDelete(null);
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("O'qituvchini o'chirishda xatolik yuz berdi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            O'qituvchilar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Markazdagi barcha o'qituvchilar</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && teachers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-brand-line rounded-full text-[12px] font-semibold text-slate-600">
              <User size={14} className="text-slate-400" /> {teachers.length} o&apos;qituvchi
            </span>
          )}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 pl-4 pr-5 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-full transition-all shadow-sm shadow-brand-600/25 active:scale-[0.98]"
        >
          <Plus size={18} strokeWidth={2.5} />
          O'qituvchi qo'shish
        </button>
        </div>
      </div>

      {/* Teacher profile cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-brand-line rounded-3xl p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-slate-200 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
              <div className="h-9 bg-slate-100 rounded-xl mt-5" />
            </div>
          ))}
        </div>
      ) : teachers.length === 0 ? (
        <div className="bg-white border border-brand-line rounded-3xl p-14 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center text-brand-700 mb-3">
            <User size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Hali o&apos;qituvchilar yo&apos;q</h3>
          <p className="text-[13px] text-slate-400 mt-1 max-w-[250px]">Birinchi o&apos;qituvchini email orqali qo&apos;shing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {teachers.map((teacher) => {
            const p = profiles[teacher.teacherId] || {};
            const stats = teacherStats.get(teacher.teacherId);
            return (
              <div key={teacher.id}
                className="group bg-white rounded-3xl border border-brand-line hover:shadow-md hover:shadow-slate-200/60 hover:-translate-y-0.5 hover:border-brand-200 transition-all overflow-hidden flex flex-col">
                {/* Clickable profile body */}
                <button type="button" onClick={() => setViewingTeacher(teacher)} className="flex-1 text-left p-5">
                  <div className="flex items-start gap-4">
                    {/* Rectangular photo */}
                    {p.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoURL} alt={teacher.teacherName}
                        className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-100" />
                    ) : (
                      <div className={`w-20 h-20 rounded-2xl shrink-0 bg-gradient-to-br flex items-center justify-center font-black text-[22px] ${tintFor(teacher.teacherId)}`}>
                        {getInitials(teacher.teacherName)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-[15.5px] font-bold text-slate-900 truncate group-hover:text-brand-700 transition-colors">
                          {teacher.teacherName}
                        </h3>
                        {p.verifiedTeacher && (
                          <BadgeCheck size={16} className="text-sky-500 shrink-0" aria-label="Tasdiqlangan" />
                        )}
                      </div>

                      {/* Subject + experience */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {p.subject && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-800 rounded-full text-[11px] font-bold capitalize">
                            <BookOpen size={11} /> {p.subject}
                          </span>
                        )}
                        {typeof p.experience === "number" && p.experience > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold">
                            {p.experience} yil tajriba
                          </span>
                        )}
                      </div>

                      {/* Contact */}
                      <div className="mt-2.5 space-y-1">
                        <p className="flex items-center gap-1.5 text-[12px] text-slate-500 truncate">
                          <Mail size={12} className="text-slate-400 shrink-0" /> {teacher.teacherEmail}
                        </p>
                        {p.phone && (
                          <p className="flex items-center gap-1.5 text-[12px] text-slate-500 truncate">
                            <Phone size={12} className="text-slate-400 shrink-0" /> {p.phone}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          Qo&apos;shilgan: {teacher.addedAt?.toDate ? teacher.addedAt.toDate().toLocaleDateString("uz-UZ") : "hozirgina"}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Footer: stats + actions */}
                <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3 text-[12px] font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-slate-400" />
                      <span className="tabular-nums">{stats?.groups || 0}</span> guruh
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-slate-400" />
                      <span className="tabular-nums">{stats?.students || 0}</span> o&apos;quvchi
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setTeacherToDelete(teacher)}
                      title="O'qituvchini markazdan o'chirish"
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                      <Trash2 size={16} />
                    </button>
                    <button type="button" onClick={() => setViewingTeacher(teacher)}
                      title="Profilni ko'rish"
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 shrink-0">
                <User size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">O'qituvchi qo'shish</h2>
                <p className="text-[13px] text-slate-500">Emailini kiriting — tizimdan topib qo'shamiz.</p>
              </div>
            </div>

            <form onSubmit={handleAddTeacher} className="space-y-4">
              
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-[13px] font-bold text-slate-700 ml-1">O'qituvchi emaili</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="misol@gmail.com"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60"
                  />
                </div>
                {modalError && (
                  <p className="text-[13px] font-bold text-red-500 mt-2 px-1 animate-in slide-in-from-top-1">
                    {modalError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors disabled:opacity-60"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !emailInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-full transition-colors disabled:opacity-60 shadow-sm shadow-brand-600/25"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Qidirilmoqda...
                    </>
                  ) : (
                    "Qo'shish"
                  )}
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}

      {/* Teacher Info Slide-Over */}
      {viewingTeacher && viewingTeacher.id && (
        <ManagerTeacherInfoPanel
          teacherUid={viewingTeacher.teacherId}
          onPhotoChange={(url) =>
            setProfiles((prev) => ({
              ...prev,
              [viewingTeacher.teacherId]: { ...prev[viewingTeacher.teacherId], photoURL: url || undefined },
            }))
          }
          onClose={() => setViewingTeacher(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {teacherToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !isDeleting && setTeacherToDelete(null)}
          ></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2rem] p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-100">
              <Trash2 size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">O'chirishni tasdiqlang</h3>
            <p className="text-sm text-slate-500 mb-8">
              <span className="font-bold text-slate-800">{teacherToDelete.teacherName}</span> markazdan o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setTeacherToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button 
                onClick={confirmDeleteTeacher}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full shadow-md shadow-rose-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    O'chirilmoqda...
                  </>
                ) : (
                  "O'chirish"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
