"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { X, Loader2, User, Phone, Briefcase, MapPin, AtSign, BookOpen, GraduationCap, Calendar, Info } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  teacherUid: string;
  onClose: () => void;
}

const formatPhoneNumber = (value: string) => {
  if (!value) return "Kiritilmagan";
  return value;
};

export default function ManagerTeacherInfoPanel({ teacherUid, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const [formData, setFormData] = useState({ 
    displayName: '', username: '', email: '', phone: '', birthDate: '', 
    institution: '', bio: '', gender: '', subject: '', experience: 0, 
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
    </div>
  );
}
