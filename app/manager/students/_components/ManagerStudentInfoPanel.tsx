"use client";

/**
 * Student profile DIALOG for the manager (mobile-first: bottom sheet on
 * phones, centered card on desktop — the student twin of the teacher dialog):
 * profile view + EDIT (via PATCH /api/manager/students/[uid]), center groups
 * with schedule times, finance state (StudentFinanceSection), photo
 * management, remove-from-center, and — for center-created accounts — the
 * credentials card with the manager-visible password
 * (center_student_credentials — docs/MANAGER.md).
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { doc, getDoc, deleteDoc, updateDoc, arrayRemove } from "firebase/firestore";
import {
  X, Loader2, User, Phone, MapPin, AtSign, Calendar, Info, Layers,
  Flame, Star, Briefcase, Camera, Trash2, Pencil, KeyRound, Copy,
  Eye, EyeOff, RefreshCw, Check, ChevronDown, Mail, Clock,
  ArrowRight, GraduationCap, UserMinus, Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import PhotoCropperModal from "@/app/manager/_components/PhotoCropperModal";
import StudentFinanceSection from "@/app/manager/finance/_components/StudentFinanceSection";
import { managerApiFetch } from "@/lib/managerApi";
import { getContactOf } from "@/lib/directory";
import { generateFriendlyPassword } from "@/lib/teacherProvision";
import type { ClassData } from "@/hooks/useCenterClasses";

// Same weekday convention as the group detail page (0 = Sunday).
const DAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const GRADE_OPTIONS = [
  ...Array.from({ length: 11 }, (_, i) => ({ value: `school_${i + 1}`, label: `${i + 1} - Sinf` })),
  { value: "uni", label: "Universitet / Boshqa" },
];
const gradeLabel = (g: string) => GRADE_OPTIONS.find((o) => o.value === g)?.label || "";

interface Props {
  studentUid: string;
  /** Name already shown in the table — rendered while the doc loads. */
  fallbackName: string;
  centerId?: string | null;
  /** The student's center groups (already loaded by the page — no extra reads). */
  classes?: ClassData[];
  /** Today's attendance chip, precomputed by the students page. */
  todayBadge?: { label: string; cls: string; dot: string };
  /** Fired after the manager sets/removes the photo, so the list can update. */
  onPhotoChange?: (url: string | null) => void;
  /** Fired after the student is removed from the center (list refresh). */
  onRemoved?: () => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Module-level (NOT inside the component) — inline components remount on every
// render and drop input focus per keystroke.
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

interface ProfileData {
  displayName: string;
  username: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  grade: string;
  institution: string;
  bio: string;
  region: string;
  photoURL: string | null;
  totalXP: number;
  currentStreak: number;
  accountType?: string;
}

interface EditDraft {
  displayName: string;
  grade: string;
  phone: string;
  birthDate: string;
  gender: string;
  institution: string;
  bio: string;
  region: string;
}

export default function ManagerStudentInfoPanel({
  studentUid, fallbackName, centerId, classes = [], todayBadge, onPhotoChange, onRemoved, onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isMember, setIsMember] = useState(false); // center_students link exists

  // Credentials (only for center-created accounts).
  const [password, setPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Remove-from-center
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [snap, contact, credsSnap, linkSnap] = await Promise.all([
          getDoc(doc(db, "users", studentUid)),
          getContactOf(studentUid).catch(() => ({ email: "", phone: "" })),
          getDoc(doc(db, "center_student_credentials", studentUid)).catch(() => null),
          centerId
            ? getDoc(doc(db, "center_students", `${centerId}_${studentUid}`)).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (!isMounted) return;
        if (!snap.exists()) {
          toast.error("O'quvchi ma'lumotlari topilmadi.");
          handleClose();
          return;
        }
        const data = snap.data();
        setProfile({
          displayName: data.displayName || fallbackName || "Kiritilmagan",
          username: data.username || "",
          email: contact.email || data.email || "",
          phone: contact.phone || "",
          birthDate: data.birthDate || "",
          gender: data.gender || "",
          grade: data.grade || "",
          institution: data.institution || "",
          bio: data.bio || "",
          region: data.location?.region || "",
          photoURL: data.photoURL || null,
          totalXP: data.totalXP || 0,
          currentStreak: data.currentStreak || 0,
          accountType: data.accountType,
        });
        if (credsSnap?.exists()) setPassword(credsSnap.data().password || null);
        setIsMember(!!linkSnap?.exists());
      } catch {
        if (isMounted) toast.error("Yuklashda xatolik yuz berdi.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentUid, centerId]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const startEditing = () => {
    if (!profile) return;
    setDraft({
      displayName: profile.displayName === "Kiritilmagan" ? "" : profile.displayName,
      grade: profile.grade,
      phone: profile.phone,
      birthDate: profile.birthDate,
      gender: profile.gender,
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
      await managerApiFetch(`/api/manager/students/${studentUid}`, {
        method: "PATCH",
        body: {
          displayName: draft.displayName.trim(),
          grade: draft.grade,
          phone: draft.phone.trim(),
          birthDate: draft.birthDate,
          gender: draft.gender,
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
      await managerApiFetch(`/api/manager/students/${studentUid}`, {
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

  /** Remove from the center: delete the roster link + leave every center group. */
  const handleRemoveFromCenter = async () => {
    if (!centerId) return;
    setIsRemoving(true);
    try {
      for (const c of classes) {
        await updateDoc(doc(db, "classes", c.id), { studentIds: arrayRemove(studentUid) });
      }
      await deleteDoc(doc(db, "center_students", `${centerId}_${studentUid}`)).catch(() => {});
      toast.success("O'quvchi markazdan chiqarildi.");
      onRemoved?.();
      handleClose();
    } catch (err: any) {
      toast.error(err.message || "Chiqarishda xatolik yuz berdi.");
      setIsRemoving(false);
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
        body: { targetUid: studentUid, imageBase64: dataUrl },
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
        body: { targetUid: studentUid },
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

  const genderLabel = (g: string) => (g === "male" ? "O'g'il bola" : g === "female" ? "Qiz bola" : "Kiritilmagan");
  const studentClasses = [...classes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

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
              <h2 className="text-lg font-black text-slate-900 tracking-tight">O&apos;quvchi Ma&apos;lumotlari</h2>
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
            <div className="space-y-4 sm:space-y-6">

              {/* Identity */}
              <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line flex items-center gap-4">
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
                    {todayBadge && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${todayBadge.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${todayBadge.dot}`} /> {todayBadge.label}
                      </span>
                    )}
                    {profile.grade && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-800 rounded-full text-[11px] font-bold">
                        <GraduationCap size={11} /> {gradeLabel(profile.grade)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[11px] font-bold">
                      <Star size={11} /> {profile.totalXP} XP
                    </span>
                    {profile.currentStreak > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full text-[11px] font-bold">
                        <Flame size={11} /> {profile.currentStreak}
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
                <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-4">
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
                      { label: "Username", value: profile.username, icon: AtSign },
                      { label: "Email", value: profile.email, icon: Mail },
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
                <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-5">
                  <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Pencil size={13} /> Ma&apos;lumotlarni Tahrirlash
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditField label="To'liq Ism" span={2}>
                      <input type="text" value={draft.displayName} disabled={isSavingEdit}
                        onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} className={inputCls} />
                    </EditField>
                    <EditField label="Sinf">
                      <div className="relative">
                        <select value={draft.grade} disabled={isSavingEdit}
                          onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
                          className={`${inputCls} appearance-none pr-9`}>
                          <option value="">Tanlanmagan</option>
                          {GRADE_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
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
                          <option value="male">O&apos;g&apos;il bola</option>
                          <option value="female">Qiz bola</option>
                        </select>
                        <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </EditField>
                    <EditField label="Muassasa (maktab)">
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
                  {/* Groups + schedule */}
                  <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line">
                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <Layers size={14}/> Guruhlar
                      <span className="ml-1 px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-md text-[10px] tabular-nums">{studentClasses.length}</span>
                    </h3>

                    {studentClasses.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[13px] font-bold text-slate-400">Hozircha guruhga qo&apos;shilmagan</p>
                        <p className="text-[11.5px] text-slate-400 mt-1">Guruh sahifasidagi &quot;O&apos;quvchi qo&apos;shish&quot; orqali biriktiring.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {studentClasses.map((c) => {
                          const schedule = [...(c.schedule || [])].sort(
                            (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek),
                          );
                          return (
                            <Link key={c.id} href={`/manager/groups/${c.id}`}
                              className="group block p-4 bg-slate-50/70 hover:bg-brand-50/60 border border-slate-100 hover:border-brand-200 rounded-2xl transition-colors">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[14px] font-bold text-slate-900 truncate group-hover:text-brand-700 transition-colors">{c.title}</p>
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-600">
                                  <User size={11} className="text-slate-400" /> {c.teacherName}
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

                  {/* Finance state */}
                  {centerId && (
                    <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line">
                      <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                        <Wallet size={14}/> Moliya
                      </h3>
                      <StudentFinanceSection centerId={centerId} studentUid={studentUid} />
                    </div>
                  )}

                  {/* Personal info */}
                  <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border border-brand-line space-y-5">
                    <h3 className="text-[12px] font-black text-brand-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <User size={14}/> Shaxsiy Ma&apos;lumotlar
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <InfoField label="To'liq Ism" value={profile.displayName} icon={User} span={2} />
                      <InfoField label="Username" value={profile.username} icon={AtSign} />
                      <InfoField label="Email" value={profile.email} icon={Mail} />
                      <InfoField label="Telefon" value={profile.phone} icon={Phone} />
                      <InfoField label="Tug'ilgan sana" value={profile.birthDate} icon={Calendar} />
                      <InfoField label="Jinsi" value={genderLabel(profile.gender)} />
                      <InfoField label="Sinf" value={gradeLabel(profile.grade)} icon={GraduationCap} />
                      <InfoField label="Muassasa" value={profile.institution} icon={Briefcase} />
                      <InfoField label="Viloyat" value={profile.region} icon={MapPin} />
                    </div>
                  </div>

                  {/* Remove from center */}
                  {isMember && centerId && (
                    <div className="bg-white p-5 rounded-[1.5rem] border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {confirmRemove ? (
                        <>
                          <p className="text-[13px] font-bold text-slate-700">
                            Rostdan ham markazdan chiqarilsinmi? Barcha guruhlardan ham chiqariladi.
                          </p>
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => setConfirmRemove(false)} disabled={isRemoving}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[12.5px] rounded-full transition-colors disabled:opacity-50">
                              Bekor qilish
                            </button>
                            <button type="button" onClick={handleRemoveFromCenter} disabled={isRemoving}
                              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[12.5px] rounded-full transition-colors disabled:opacity-50">
                              {isRemoving ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />} Chiqarish
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <p className="text-[13.5px] font-bold text-slate-800">Markazdan chiqarish</p>
                            <p className="text-[12px] text-slate-400 mt-0.5">Ro&apos;yxatdan va barcha guruhlardan olib tashlanadi. Hisob o&apos;chirilmaydi.</p>
                          </div>
                          <button type="button" onClick={() => setConfirmRemove(true)}
                            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[12.5px] rounded-full transition-colors">
                            <UserMinus size={14} /> Chiqarish
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for the manager-set photo */}
      <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) setPhotoFile(e.target.files[0]); }} />

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
