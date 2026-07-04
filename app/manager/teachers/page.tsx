"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Mail, User, Loader2, Edit2, Save, X } from "lucide-react";
import { collection, query, where, getDocs, getDoc, addDoc, setDoc, deleteDoc, doc, onSnapshot, serverTimestamp, limit, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getUserProfile } from "@/services/userService";
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
      
      // 3. Duplicate Check
      const ctRef = collection(db, "center_teachers");
      const duplicateQuery = query(
        ctRef,
        where("centerId", "==", centerId),
        where("teacherId", "==", foundUserUid)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      if (!duplicateSnapshot.empty) {
        throw new Error("Bu o'qituvchi markazga allaqachon qo'shilgan.");
      }
      
      const ctDocId = foundUserUid;
      const ctDocRef = doc(db, "center_teachers", ctDocId);
      
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
          <h1 className="text-2xl md:text-[28px] font-black text-slate-900 tracking-tight leading-tight">
            O'qituvchilar
          </h1>
          <p className="text-[14px] font-medium text-slate-500 mt-1">Markazingizdagi barcha o'qituvchilar ro'yxati</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-sm shadow-amber-500/20 active:scale-95"
        >
          <Plus size={18} strokeWidth={2.5} />
          O'qituvchi qo'shish
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Ism-Familiya</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Qo'shilgan sana</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Harakatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {loading ? (
                // Loading Skeleton
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-200 rounded-full shrink-0"></div>
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-8 bg-slate-200 rounded-lg w-10 ml-auto"></div></td>
                  </tr>
                ))
              ) : teachers.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-3 border border-slate-100">
                        <User size={32} />
                      </div>
                      <h3 className="text-[15px] font-bold text-slate-700">O'qituvchilar yo'q</h3>
                      <p className="text-[13px] text-slate-500 mt-1 max-w-[250px]">Markazingizga hali hech qanday o'qituvchi qo'shilmagan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                // Actual Data
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0">
                          {teacher.teacherName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[14px] font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                          {teacher.teacherName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Mail size={14} className="shrink-0" />
                        <span className="text-[13px] font-medium">{teacher.teacherEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[13px] font-medium text-slate-500">
                        {teacher.addedAt?.toDate ? teacher.addedAt.toDate().toLocaleDateString('uz-UZ') : 'Hozirgina'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 relative z-10">
                        <button 
                          onClick={() => setViewingTeacher(teacher)}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Batafsil ma'lumotlarni ko'rish"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                        </button>
                        <button 
                          onClick={() => setTeacherToDelete(teacher)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="O'qituvchini markazdan o'chirish"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* Add Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-100 shrink-0">
                <User size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Yangi o'qituvchi qo'shish</h2>
                <p className="text-[13px] text-slate-500 font-medium">O'qituvchini tizimga ulash uchun uning elektron pochtasini kiriting.</p>
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
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all disabled:opacity-60"
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
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-60"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !emailInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60 shadow-sm shadow-amber-500/20"
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
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">O'chirishni tasdiqlang</h3>
            <p className="text-[14px] text-slate-500 font-medium mb-8">
              Rostdan ham <span className="font-bold text-slate-800">{teacherToDelete.teacherName}</span>ni markazdan o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setTeacherToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button 
                onClick={confirmDeleteTeacher}
                disabled={isDeleting}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md shadow-red-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
