"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  X, Loader2, User, Phone, MapPin, AtSign, Calendar,
  Info, Layers, ChevronRight, Flame, Star, Briefcase, Camera, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import PhotoCropperModal from "@/app/manager/_components/PhotoCropperModal";
import { managerApiFetch } from "@/lib/managerApi";
import StudentFinanceSection from "@/app/manager/finance/_components/StudentFinanceSection";

interface Props {
  studentUid: string;
  /** Name already shown in the table — rendered while the doc loads. */
  fallbackName: string;
  /** Enables the finance section (balance, discount, freeze) when provided. */
  centerId?: string | null;
  groups: { id: string; title: string }[];
  /** Today's attendance chip, precomputed by the students page. */
  todayBadge?: { label: string; cls: string; dot: string };
  /** Fired after the manager sets/removes the photo, so the list can update. */
  onPhotoChange?: (url: string | null) => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ManagerStudentInfoPanel({ studentUid, fallbackName, centerId, groups, todayBadge, onPhotoChange, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Manager-set photo flow (upload goes through /api/manager/user-photo).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: fallbackName || "Kiritilmagan",
    username: "",
    email: "",
    phone: "",
    birthDate: "",
    gender: "",
    institution: "",
    bio: "",
    photoURL: "" as string | null,
    totalXP: 0,
    currentStreak: 0,
    location: { country: "Uzbekistan", region: "", district: "" },
  });

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", studentUid));
        if (snap.exists() && isMounted) {
          const data = snap.data();
          setFormData({
            displayName: data.displayName || fallbackName || "Kiritilmagan",
            username: data.username || "",
            email: data.email || "Kiritilmagan",
            phone: data.phone || "",
            birthDate: data.birthDate || "",
            gender: data.gender || "",
            institution: data.institution || "",
            bio: data.bio || "",
            photoURL: data.photoURL || null,
            totalXP: data.totalXP || 0,
            currentStreak: data.currentStreak || 0,
            location: {
              country: data.location?.country || "Uzbekistan",
              region: data.location?.region || "",
              district: data.location?.district || "",
            },
          });
        } else if (isMounted) {
          toast.error("O'quvchi ma'lumotlari topilmadi.");
          handleClose();
        }
      } catch (err) {
        if (isMounted) toast.error("Yuklashda xatolik yuz berdi.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentUid]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleSavePhoto = async (blob: Blob) => {
    setIsSavingPhoto(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi."));
        reader.readAsDataURL(blob);
      });
      const { photoURL } = await managerApiFetch<{ photoURL: string }>("/api/manager/user-photo", {
        method: "POST",
        body: { targetUid: studentUid, imageBase64: dataUrl },
      });
      setFormData((prev) => ({ ...prev, photoURL }));
      onPhotoChange?.(photoURL);
      setPhotoFile(null);
      toast.success("Rasm yangilandi!");
    } catch (err: any) {
      toast.error(err.message || "Rasm yuklashda xatolik");
    } finally {
      setIsSavingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    setIsSavingPhoto(true);
    try {
      await managerApiFetch("/api/manager/user-photo", {
        method: "DELETE",
        body: { targetUid: studentUid },
      });
      setFormData((prev) => ({ ...prev, photoURL: null }));
      onPhotoChange?.(null);
      setShowPhotoViewer(false);
      toast.success("Rasm o'chirildi!");
    } catch (err: any) {
      toast.error(err.message || "O'chirishda xatolik");
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const InfoField = ({ label, value, icon: Icon, span = 1 }: { label: string, value: string, icon?: any, span?: number }) => (
    <div className={`space-y-1.5 col-span-2 ${span === 1 ? 'md:col-span-1' : ''}`}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
      <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-800">
        {Icon && <Icon className="text-indigo-400 shrink-0" size={16} />}
        <span className="text-[14px] font-bold truncate">{value || 'Kiritilmagan'}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />

      {/* Slide-Over Panel */}
      <div
        className={`relative w-full max-w-xl h-full bg-[#FAFAFA] shadow-2xl flex flex-col transform transition-transform duration-300 ${isClosing ? "translate-x-full" : "translate-x-0"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100/50">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">O'quvchi Ma'lumotlari</h2>
              <p className="text-[12px] font-medium text-slate-500 mt-0.5">Batafsil ma'lumotlar ko'rinishi</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 hover:text-red-500 text-slate-400 rounded-full transition-colors"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Identity block: photo + name + today's status */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="relative shrink-0">
                    {formData.photoURL ? (
                      <button type="button" onClick={() => setShowPhotoViewer(true)} title="To'liq ko'rish" className="block active:scale-95 transition-transform">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={formData.photoURL} alt={formData.displayName} className="w-20 h-20 rounded-2xl object-cover border border-slate-100" />
                      </button>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 flex items-center justify-center font-black text-[22px]">
                        {getInitials(formData.displayName)}
                      </div>
                    )}
                    {/* Manager can set the member's photo */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSavingPhoto}
                      title="Rasm o'rnatish"
                      className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center border-[3px] border-white shadow-md transition-transform active:scale-90 disabled:opacity-50 z-10"
                    >
                      {isSavingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} strokeWidth={2.5} />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-black text-slate-900 tracking-tight truncate">{formData.displayName}</h3>
                    {formData.username && <p className="text-[13px] font-bold text-slate-400 truncate">@{formData.username}</p>}
                    {todayBadge && (
                      <span className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${todayBadge.cls}`}>
                        <span className={`w-2 h-2 rounded-full ${todayBadge.dot}`} /> {todayBadge.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Gamification strip */}
                <div className="grid grid-cols-2 gap-3 mt-5 relative z-10">
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <Star size={16} className="text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-black text-slate-800 tabular-nums leading-none">{formData.totalXP}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Umumiy XP</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <Flame size={16} className="text-orange-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-black text-slate-800 tabular-nums leading-none">{formData.currentStreak} kun</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Streak</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Info Block */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 space-y-5">
                <h3 className="text-[12px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <User size={14}/> Asosiy Ma'lumotlar
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InfoField label="Email" value={formData.email} icon={AtSign} />
                  <InfoField label="Telefon" value={formData.phone} icon={Phone} />
                  <InfoField label="Tug'ilgan sana" value={formData.birthDate} icon={Calendar} />
                  <InfoField label="Jinsi" value={formData.gender === 'male' ? 'Erkak' : formData.gender === 'female' ? 'Ayol' : 'Kiritilmagan'} />
                  <InfoField label="Muassasa" value={formData.institution} icon={Briefcase} span={2} />
                </div>
              </div>

              {/* Groups Block */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60">
                <h3 className="text-[12px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Layers size={14}/> Guruhlari
                </h3>
                {groups.length === 0 ? (
                  <p className="text-[13px] text-slate-400 font-medium">Guruhlarga qo'shilmagan.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <Link
                        key={g.id}
                        href={`/manager/attendance/${g.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[13px] font-bold transition-colors max-w-full"
                      >
                        <span className="truncate">{g.title}</span>
                        <ChevronRight size={13} className="shrink-0 opacity-60" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Finance Block */}
              {centerId && <StudentFinanceSection centerId={centerId} studentUid={studentUid} />}

              {/* Location & Bio Block */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 space-y-5">
                <h3 className="text-[12px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <MapPin size={14}/> Joylashuv & Bio
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <InfoField label="Viloyat" value={formData.location?.region} />
                  <InfoField label="Tuman" value={formData.location?.district} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">O'quvchi haqida (Bio)</label>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-[13px] leading-relaxed font-medium min-h-[80px]">
                    {formData.bio || "Ma'lumot yo'q"}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for the manager-set photo */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) setPhotoFile(e.target.files[0]); }} />

      {/* Cropper for the manager-set photo */}
      {photoFile && (
        <PhotoCropperModal
          file={photoFile}
          busy={isSavingPhoto}
          onCancel={() => { setPhotoFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
          onSave={handleSavePhoto}
        />
      )}

      {/* Full-screen photo viewer — manager can also remove the photo */}
      {showPhotoViewer && formData.photoURL && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPhotoViewer(false)}></div>
          <div className="relative w-full max-w-lg aspect-square rounded-[2rem] bg-black overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={formData.photoURL} alt={formData.displayName} className="w-full h-full object-cover" />
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={() => setShowPhotoViewer(false)} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 backdrop-blur-md transition-colors">
                <X size={20} strokeWidth={2.5} />
              </button>
              <button onClick={handleDeletePhoto} disabled={isSavingPhoto} title="Rasmni o'chirish" className="w-10 h-10 rounded-full bg-black/40 text-red-400 hover:text-red-500 hover:bg-red-500/20 flex items-center justify-center backdrop-blur-md transition-colors disabled:opacity-50">
                {isSavingPhoto ? <Loader2 size={18} className="animate-spin text-white" /> : <Trash2 size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
