"use client";

/**
 * Teacher profile DIALOG for the manager (mobile-first: bottom sheet on
 * phones, centered card on desktop): view + EDIT profile fields (via PATCH
 * /api/manager/teachers/[uid]), the teacher's center groups with their
 * schedule times, and — for center-created accounts — the login credentials
 * card with the manager-visible password (center_teacher_credentials —
 * docs/MANAGER.md).
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  X, Loader2, User, Phone, Briefcase, MapPin, AtSign, BookOpen,
  GraduationCap, Calendar, Info, Camera, Trash2, Pencil, KeyRound,
  Copy, Eye, EyeOff, RefreshCw, Check, ChevronDown, Mail,
  Layers, Users, Clock, ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import PhotoCropperModal from "@/app/manager/_components/PhotoCropperModal";
import { managerApiFetch } from "@/lib/managerApi";
import { getContactOf } from "@/lib/directory";
import { generateFriendlyPassword } from "@/lib/teacherProvision";
import { SUBJECT_OPTIONS } from "./CreateTeacherModal";
import type { ClassData } from "@/hooks/useCenterClasses";

// Same weekday convention as the group detail page (0 = Sunday).
const DAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  teacherUid: string;
  /** The teacher's center groups (already loaded by the page — no extra reads). */
  classes?: ClassData[];
  /** Fired after the manager sets/removes the photo, so the card list can update. */
  onPhotoChange?: (url: string | null) => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface ProfileData {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  birthDate: string;
  institution: string;
  bio: string;
  gender: string;
  subject: string;
  experience: number;
  region: string;
  photoURL: string | null;
  accountType?: string;
}

// Module-level (NOT inside the component): an inline-defined component gets a
// new identity every render, which remounts its children and drops input focus
// on each keystroke.
const inputCls = "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-[14px] font-semibold text-slate-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60";

function InfoField({ label, value, icon: Icon, span = 1 }: { label: string, value: string, icon?: any, span?: number }) {
  return (
    <div className={`space-y-1.5 col-span-2 ${span === 1 ? 'md:col-span-1' : ''}`}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
      <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-800">
        {Icon && <Icon className="text-brand-600 shrink-0" size={16} />}
        <span className="text-[14px] font-bold truncate">{value || 'Kiritilmagan'}</span>
      </div>
    </div>
  );
}

function EditField({ label, children, span = 1 }: { label: string, children: React.ReactNode, span?: number }) {
  return (
    <div className={`space-y-1.5 col-span-2 ${span === 1 ? 'md:col-span-1' : ''}`}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
      {children}
    </div>
  );
}

/** The PATCH-able subset the edit form works on. */
interface EditDraft {
  displayName: string;
  subject: string;
  phone: string;
  birthDate: string;
  gender: string;
  experience: number;
  institution: string;
  bio: string;
  region: string;
}

export default function ManagerTeacherInfoPanel({ teacherUid, classes = [], onPhotoChange, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // Manager-set photo flow (upload goes through /api/manager/user-photo).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Credentials (only exists for center-created accounts).
  const [password, setPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        // Contact details come from /api/directory/contact (owner-only
        // subcollection) — the public users doc no longer carries them.
        const [snap, contact, credsSnap] = await Promise.all([
          getDoc(doc(db, "users", teacherUid)),
          getContactOf(teacherUid).catch(() => ({ email: "", phone: "" })),
          getDoc(doc(db, "center_teacher_credentials", teacherUid)).catch(() => null),
        ]);
        if (!isMounted) return;
        if (!snap.exists()) {
          toast.error("O'qituvchi ma'lumotlari topilmadi.");
          handleClose();
          return;
        }
        const data = snap.data();
        setProfile({
          displayName: data.displayName || "Kiritilmagan",
          username: data.username || "",
          email: contact.email || data.email || "",
          phone: contact.phone || "",
          birthDate: data.birthDate || "",
          institution: data.institution || "",
          bio: data.bio || "",
          gender: data.gender || "",
          subject: data.subject || "",
          experience: data.experience || 0,
          region: data.location?.region || "",
          photoURL: data.photoURL || null,
          accountType: data.accountType,
        });
        if (credsSnap?.exists()) setPassword(credsSnap.data().password || null);
      } catch {
        if (isMounted) toast.error("Yuklashda xatolik yuz berdi.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherUid]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const startEditing = () => {
    if (!profile) return;
    setDraft({
      displayName: profile.displayName === "Kiritilmagan" ? "" : profile.displayName,
      subject: profile.subject,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
      experience: profile.experience,
      institution: profile.institution,
      bio: profile.bio,
      region: profile.region,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!draft || !profile) return;
    if (draft.displayName.trim().length < 3) {
      toast.error("To'liq ism kamida 3 harf bo'lishi kerak.");
      return;
    }
    setIsSavingEdit(true);
    try {
      await managerApiFetch(`/api/manager/teachers/${teacherUid}`, {
        method: "PATCH",
        body: {
          displayName: draft.displayName.trim(),
          subject: draft.subject,
          phone: draft.phone.trim(),
          birthDate: draft.birthDate,
          gender: draft.gender,
          experience: draft.experience,
          institution: draft.institution.trim(),
          bio: draft.bio.trim(),
          region: draft.region.trim(),
        },
      });
      setProfile({ ...profile, ...draft, displayName: draft.displayName.trim() });
      setIsEditing(false);
      toast.success("Ma'lumotlar saqlandi!");
    } catch (err: any) {
      toast.error(err.message || "Saqlashda xatolik yuz berdi.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile) return;
    const newPassword = generateFriendlyPassword(profile.displayName);
    setIsResettingPassword(true);
    try {
      await managerApiFetch(`/api/manager/teachers/${teacherUid}`, {
        method: "PATCH",
        body: { password: newPassword },
      });
      setPassword(newPassword);
      setShowPassword(true);
      toast.success("Yangi parol o'rnatildi!");
    } catch (err: any) {
      toast.error(err.message || "Parolni o'zgartirishda xatolik.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const copyValue = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} nusxalandi`);
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
      setProfile((prev) => (prev ? { ...prev, photoURL } : prev));
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
      setProfile((prev) => (prev ? { ...prev, photoURL: null } : prev));
      onPhotoChange?.(null);
      setShowPhotoViewer(false);
      toast.success("Rasm o'chirildi!");
    } catch (err: any) {
      toast.error(err.message || "O'chirishda xatolik");
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const genderLabel = (g: string) => (g === "male" ? "Erkak" : g === "female" ? "Ayol" : "Kiritilmagan");
  const subjectLabel = (s: string) => SUBJECT_OPTIONS.find((o) => o.value === s)?.label || (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

  const teacherClasses = [...classes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />

      {/* Dialog card — bottom sheet on mobile, centered card from sm: up */}
      <div
        className={`relative w-full sm:max-w-2xl max-h-[94dvh] sm:max-h-[90vh] bg-[#FAFAFA] shadow-2xl flex flex-col rounded-t-[1.75rem] sm:rounded-[2rem] overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 ${isClosing ? "opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95" : "opacity-100 translate-y-0 sm:scale-100"}`}
      >
        {/* M3 bottom-sheet drag handle (mobile only) */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0 bg-white">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">O&apos;qituvchi Ma&apos;lumotlari</h2>
              <p className="text-[12px] font-medium text-slate-500 mt-0.5">
                {isEditing ? "Tahrirlash rejimi" : "Batafsil ma'lumotlar ko'rinishi"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && profile && !isEditing && (
              <button
                onClick={startEditing}
                title="Tahrirlash"
                className="flex items-center gap-1.5 pl-3 pr-4 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[13px] rounded-full transition-colors"
              >
                <Pencil size={14} strokeWidth={2.5} /> Tahrirlash
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 hover:text-red-500 text-slate-400 rounded-full transition-colors"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 sm:space-y-6">
          {loading || !profile ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-brand-600" size={32} />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Identity block: photo + name */}
              <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line flex items-center gap-4">
                <div className="relative shrink-0">
                  {profile.photoURL ? (
                    <button type="button" onClick={() => setShowPhotoViewer(true)} title="To'liq ko'rish" className="block active:scale-95 transition-transform">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={profile.photoURL} alt={profile.displayName} className="w-20 h-20 rounded-2xl object-cover border border-slate-100" />
                    </button>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-800 flex items-center justify-center font-black text-[22px]">
                      {getInitials(profile.displayName)}
                    </div>
                  )}
                  {/* Manager can set the member's photo */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSavingPhoto}
                    title="Rasm o'rnatish"
                    className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center border-[3px] border-white shadow-md transition-transform active:scale-90 disabled:opacity-50 z-10"
                  >
                    {isSavingPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} strokeWidth={2.5} />}
                  </button>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[17px] font-black text-slate-900 tracking-tight truncate">{profile.displayName}</h3>
                  {profile.username && (
                    <p className="text-[13px] font-bold text-slate-400 truncate">@{profile.username}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {profile.subject && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-800 rounded-full text-[11px] font-bold">
                        <BookOpen size={11} /> {subjectLabel(profile.subject)}
                      </span>
                    )}
                    {profile.accountType === "center-managed" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold" title="Bu hisobni markaz yaratgan">
                        <Check size={11} /> Markaz hisobi
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Login credentials — only for center-created accounts */}
              {password !== null && (
                <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1.5">
                      <KeyRound size={14} /> Login Ma&apos;lumotlari
                    </h3>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isResettingPassword}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[12px] rounded-full transition-colors disabled:opacity-50"
                    >
                      {isResettingPassword ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Yangi parol
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { label: "Username", value: profile.username, icon: AtSign, mono: true },
                      { label: "Email", value: profile.email, icon: Mail, mono: true },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <row.icon size={16} className="text-brand-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{row.label}</p>
                          <p className="text-[13.5px] font-bold text-slate-900 font-mono truncate">{row.value || "—"}</p>
                        </div>
                        {row.value && (
                          <button type="button" onClick={() => copyValue(row.label, row.value)} title="Nusxalash"
                            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-brand-700 hover:bg-brand-50 transition-colors">
                            <Copy size={15} />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Password row with reveal */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                      <KeyRound size={16} className="text-amber-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Parol</p>
                        <p className="text-[13.5px] font-bold text-slate-900 font-mono truncate">
                          {showPassword ? password : "••••••••••"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Yashirish" : "Ko'rsatish"}
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-amber-700 hover:bg-amber-100/60 transition-colors">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button type="button" onClick={() => copyValue("Parol", password)} title="Nusxalash"
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-amber-700 hover:bg-amber-100/60 transition-colors">
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[11.5px] text-slate-400 leading-relaxed">
                    Bu hisob markaz tomonidan boshqariladi — parolni faqat siz ko&apos;rasiz va o&apos;zgartira olasiz.
                  </p>
                </div>
              )}

              {isEditing && draft ? (
                /* ── EDIT MODE ── */
                <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-5">
                  <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Pencil size={13} /> Ma&apos;lumotlarni Tahrirlash
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditField label="To'liq Ism" span={2}>
                      <input type="text" value={draft.displayName} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label="Fani">
                      <div className="relative">
                        <select value={draft.subject} disabled={isSavingEdit}
                          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                          className={`${inputCls} appearance-none pr-9`}>
                          <option value="" disabled>Tanlang</option>
                          {SUBJECT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </EditField>
                    <EditField label="Telefon">
                      <input type="tel" value={draft.phone} disabled={isSavingEdit} placeholder="+998 90 123 45 67"
                        onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label="Tug'ilgan sana">
                      <input type="date" value={draft.birthDate} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label="Jinsi">
                      <div className="relative">
                        <select value={draft.gender} disabled={isSavingEdit}
                          onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                          className={`${inputCls} appearance-none pr-9`}>
                          <option value="">Tanlanmagan</option>
                          <option value="male">Erkak</option>
                          <option value="female">Ayol</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </EditField>
                    <EditField label="Tajriba (yil)">
                      <input type="number" min={0} max={60} value={draft.experience} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, experience: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} />
                    </EditField>
                    <EditField label="Muassasa">
                      <input type="text" value={draft.institution} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, institution: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label="Viloyat">
                      <input type="text" value={draft.region} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, region: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label="Bio" span={2}>
                      <textarea rows={3} value={draft.bio} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                        className={`${inputCls} resize-none leading-relaxed`} />
                    </EditField>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setIsEditing(false)} disabled={isSavingEdit}
                      className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors disabled:opacity-50">
                      Bekor qilish
                    </button>
                    <button type="button" onClick={handleSaveEdit} disabled={isSavingEdit}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-full transition-colors shadow-sm shadow-brand-600/25 disabled:opacity-50">
                      {isSavingEdit ? <><Loader2 size={16} className="animate-spin" /> Saqlanmoqda...</> : "Saqlash"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <>
                  {/* Main Info Block */}
                  <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>

                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <User size={14}/> Asosiy Ma&apos;lumotlar
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                      <InfoField label="To'liq Ism" value={profile.displayName} icon={User} span={2} />
                      <InfoField label="Username" value={profile.username} icon={AtSign} />
                      <InfoField label="Email" value={profile.email} icon={AtSign} />
                      <InfoField label="Telefon" value={profile.phone} icon={Phone} />
                      <InfoField label="Tug'ilgan sana" value={profile.birthDate} icon={Calendar} />
                    </div>
                  </div>

                  {/* Professional Info Block */}
                  <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-5">
                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <GraduationCap size={14}/> Kasbiy Ma&apos;lumotlar
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <InfoField label="Jinsi" value={genderLabel(profile.gender)} />
                      <InfoField label="Fani" value={subjectLabel(profile.subject)} icon={BookOpen} />
                      <InfoField label="Tajriba" value={profile.experience ? `${profile.experience} Yil` : ''} />
                      <InfoField label="Muassasa" value={profile.institution} icon={Briefcase} />
                    </div>
                  </div>

                  {/* Groups + schedule — the teacher's center classes */}
                  <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line">
                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <Layers size={14}/> Guruhlar
                      <span className="ml-1 px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-md text-[10px] tabular-nums">{teacherClasses.length}</span>
                    </h3>

                    {teacherClasses.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] font-bold text-slate-400">Bu o&apos;qituvchida markaz guruhlari yo&apos;q</p>
                        <p className="text-[11.5px] text-slate-400 mt-1">Guruhlar bo&apos;limidan yangi guruh yaratib biriktiring.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {teacherClasses.map((c) => {
                          const schedule = [...(c.schedule || [])].sort(
                            (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek),
                          );
                          return (
                            <Link key={c.id} href={`/manager/groups/${c.id}`}
                              className="group block p-4 bg-slate-50/70 hover:bg-brand-50/60 border border-slate-100 hover:border-brand-200 rounded-2xl transition-colors">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[14px] font-bold text-slate-900 truncate group-hover:text-brand-700 transition-colors">{c.title}</p>
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-600 tabular-nums">
                                  <Users size={11} className="text-slate-400" /> {c.studentIds?.length || 0}
                                </span>
                              </div>
                              {schedule.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {schedule.map((s, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
                                      <Clock size={10} className="text-brand-500" />
                                      {DAY_SHORT[s.dayOfWeek]} {s.startTime}–{s.endTime}
                                      {s.roomName ? <span className="text-slate-400 font-medium">· {s.roomName}</span> : null}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-1.5 text-[11.5px] font-medium text-slate-400">Dars jadvali kiritilmagan</p>
                              )}
                              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                Guruhga o&apos;tish <ArrowRight size={11} />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Location Block */}
                  <div className="bg-white p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-5">
                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <MapPin size={14}/> Joylashuv & Bio
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      <InfoField label="Viloyat" value={profile.region} />
                      <InfoField label="Bio" value={profile.bio || "Ma'lumot yo'q"} />
                    </div>
                  </div>
                </>
              )}

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
      {showPhotoViewer && profile?.photoURL && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => setShowPhotoViewer(false)}></div>
          <div className="relative w-full max-w-lg aspect-square rounded-[2rem] bg-black overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
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
