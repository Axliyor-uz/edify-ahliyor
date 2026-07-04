"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs, limit } from "firebase/firestore";
import { X, Search, UserPlus, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ManagerAddStudentModal({ classId, isOpen, onClose, onSuccess }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setFoundUser(null);

    try {
      const isEmail = searchInput.includes("@") && searchInput.includes(".");
      
      let uidToFetch = null;

      if (isEmail) {
        // Search by email
        const formattedEmail = searchInput.trim().toLowerCase();
        const usersRef = collection(db, "users");
        const userQuery = query(usersRef, where("email", "==", formattedEmail), limit(1));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          uidToFetch = userSnapshot.docs[0].id;
        }
      } else {
        // Search by username
        const cleanName = searchInput.replace("@", "").toLowerCase().trim();
        const usernameRef = doc(db, "usernames", cleanName);
        const usernameSnap = await getDoc(usernameRef);

        if (usernameSnap.exists()) {
          uidToFetch = usernameSnap.data().uid;
        }
      }

      if (uidToFetch) {
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

  const handleAddStudent = async () => {
    if (!foundUser) return;
    setIsAdding(true);
    try {
      const classRef = doc(db, "classes", classId);
      await updateDoc(classRef, { studentIds: arrayUnion(foundUser.uid) });
      
      toast.success(`${foundUser.displayName || "O'quvchi"} muvaffaqiyatli qo'shildi!`);
      setFoundUser(null);
      setSearchInput("");
      onSuccess();
    } catch (error) {
      console.error("Add student failed:", error);
      toast.error("O'quvchini qo'shishda xatolik yuz berdi.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setFoundUser(null);
    setSearchInput("");
    onClose();
  };

  const hasInput = searchInput.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>
      
      <div className="relative bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 fade-in duration-300">
        
        {/* HEADER */}
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-sm shrink-0">
               <Search size={20} strokeWidth={2.5} />
            </div>
            <h2 className="text-[18px] font-black text-slate-900 tracking-tight">O'quvchini Qo'shish</h2>
          </div>
          <button 
            onClick={handleClose} 
            className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 md:p-8 bg-[#FAFAFA]">
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Username yoki email orqali qidirish"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-11 pr-14 py-4 bg-white border border-slate-200/80 rounded-[1rem] text-[14px] font-bold text-slate-900 placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all shadow-sm"
              autoFocus
            />
            
            <button 
              onClick={handleSearch}
              disabled={isSearching || !hasInput}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm
                ${hasInput && !isSearching ? 'bg-amber-500 text-white hover:bg-amber-600 hover:scale-105 active:scale-95' : 'bg-slate-100 text-slate-400 border border-slate-200'}
              `}
            >
              {isSearching ? <Loader2 className="animate-spin" size={18}/> : <ArrowRight size={18} strokeWidth={3}/>}
            </button>
          </div>

          {/* Found User Result Card */}
          {foundUser && (
            <div className="mt-6 bg-white border border-amber-200/80 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-[0_4px_20px_rgb(245,158,11,0.06)] animate-in fade-in slide-in-from-bottom-4 duration-300 relative overflow-hidden group">
              
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex items-center gap-4 relative z-10 min-w-0">
                <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-[1rem] flex items-center justify-center font-black text-white text-[18px] shadow-md shadow-amber-500/20 shrink-0 border-2 border-white">
                  {foundUser.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-900 text-[15px] truncate">{foundUser.displayName || "Noma'lum"}</p>
                  <p className="text-[12px] font-bold text-slate-400 truncate">
                    {foundUser.username ? `@${foundUser.username}` : foundUser.email}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleAddStudent}
                disabled={isAdding}
                className="w-12 h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-[1rem] transition-all disabled:opacity-50 shadow-md shadow-amber-500/20 active:scale-95 flex items-center justify-center relative z-10 shrink-0"
              >
                {isAdding ? <Loader2 className="animate-spin" size={20}/> : <UserPlus size={20} strokeWidth={2.5}/>}
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
