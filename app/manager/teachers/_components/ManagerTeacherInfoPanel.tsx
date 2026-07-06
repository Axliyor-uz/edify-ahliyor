"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { X, Loader2, User, Phone, Briefcase, MapPin, AtSign, BookOpen, GraduationCap, Calendar, Info, Camera, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import PhotoCropperModal from "@/app/manager/_components/PhotoCropperModal";
import { managerApiFetch } from "@/lib/managerApi";

interface Props {
  teacherUid: string;
  /** Fired after the manager sets/removes the photo, so the card list can update. */
  onPhotoChange?: (url: string | null) => void;
  onClose: () => void;
}

const formatPhoneNumber = (value: string) => {
  if (!value) return "Kiritilmagan";
  return value;
};

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ManagerTeacherInfoPanel({ teacherUid, onPhotoChange, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Manager-set photo flow (upload goes through /api/manager/user-photo).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: '', username: '', email: '', phone: '', birthDate: '',
    institution: '', bio: '', gender: '', subject: '', experience: 0,
    photoURL: null as string | null,
    location: { country: 'Uzbekistan', region: '', district: '' }
  });

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', teacherUid));
        if (snap.exists() && isMounted) {
          const data = snap.data();
          setFormData({ 
            displayName: data.displayName || 'Kiritilmagan', 
            username: data.username || 'Kiritilmagan', 
            email: data.email || 'Kiritilmagan', 
            phone: data.phone || '', 
            birthDate: data.birthDate || '', 
            institution: data.institution || 'Kiritilmagan', 
            bio: data.bio || 'Ma\'lumot yo\'q', 
            gender: data.gender || '', 
            subject: data.subject || 'Kiritilmagan',
            experience: data.experience || 0,
            photoURL: data.photoURL || null,
            location: { 
              country: data.location?.country || 'Uzbekistan', 
              region: data.location?.region || 'Kiritilmagan', 
              district: data.location?.district || '' 
            } 
          });
        } else if (isMounted) {
          toast.error("O'qituvchi ma'lumotlari topilmadi.");
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
  }, [teacherUid]);

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
        body: { targetUid: teacherUid, imageBase64: dataUrl },
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
        body: { targetUid: teacherUid },
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

  // Helper for displaying fields
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
              <h2 className="text-lg font-black text-slate-900 tracking-tight">O'qituvchi Ma'lumotlari</h2>
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

              {/* Identity block: photo + name */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex items-center gap-4">
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
                  {formData.username && formData.username !== 'Kiritilmagan' && (
                    <p className="text-[13px] font-bold text-slate-400 truncate">@{formData.username}</p>
                  )}
                  {formData.subject && formData.subject !== 'Kiritilmagan' && (
                    <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[11px] font-bold capitalize">
                      <BookOpen size={11} /> {formData.subject}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Info Block */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 space-y-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>
                
                <h3 className="text-[12px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <User size={14}/> Asosiy Ma'lumotlar
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                  <InfoField label="To'liq Ism" value={formData.displayName} icon={User} span={2} />
                  <InfoField label="Username" value={formData.username} icon={AtSign} />
                  <InfoField label="Email" value={formData.email} icon={AtSign} />
                  <InfoField label="Telefon" value={formatPhoneNumber(formData.phone)} icon={Phone} />
                  <InfoField label="Tug'ilgan sana" value={formData.birthDate} icon={Calendar} />
                </div>
              </div>

              {/* Professional Info Block */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 space-y-5">
                <h3 className="text-[12px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <GraduationCap size={14}/> Kasbiy Ma'lumotlar
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InfoField label="Jinsi" value={formData.gender === 'male' ? 'Erkak' : formData.gender === 'female' ? 'Ayol' : 'Kiritilmagan'} />
                  <InfoField label="Fani" value={formData.subject.charAt(0).toUpperCase() + formData.subject.slice(1)} icon={BookOpen} />
                  <InfoField label="Tajriba" value={formData.experience ? `${formData.experience} Yil` : 'Kiritilmagan'} />
                  <InfoField label="Muassasa" value={formData.institution} icon={Briefcase} />
                </div>
              </div>

              {/* Location Block */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 space-y-5">
                <h3 className="text-[12px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <MapPin size={14}/> Joylashuv & Bio
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <InfoField label="Viloyat" value={formData.location?.region} />
                  <InfoField label="Tuman" value={formData.location?.district} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">O'qituvchi haqida (Bio)</label>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-[13px] leading-relaxed font-medium min-h-[80px]">
                    {formData.bio}
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
