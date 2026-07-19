"use client";

/**
 * Manager creates a brand-new STUDENT account — the student twin of
 * CreateTeacherModal (docs/MANAGER.md). Name + password required; email,
 * username, password auto-generated with signup-style live availability
 * checks; optional immediate enrollment into one of the center's groups.
 */

import { useState, useEffect, useRef } from "react";
import { managerApiFetch } from "@/lib/managerApi";
import { lookupByEmail } from "@/lib/directory";
import { checkUsernameUnique } from "@/services/userService";
import {
  suggestTeacherEmail,
  suggestTeacherUsername,
  generateFriendlyPassword,
  USERNAME_REGEX,
} from "@/lib/teacherProvision";
import type { ClassData } from "@/hooks/useCenterClasses";
import { GRADE_OPTIONS } from "./ManagerStudentInfoPanel";
import {
  X, User, KeyRound, RefreshCw, Loader2, Copy, AtSign, Mail, Phone,
  ChevronDown, UserPlus, PartyPopper, CheckCircle, XCircle, Layers,
  GraduationCap,
} from "lucide-react";
import toast from "react-hot-toast";

type CheckStatus = "idle" | "checking" | "free" | "taken";

function statusBorder(status: CheckStatus, base: string): string {
  if (status === "free") return `${base} border-green-300 focus:border-green-500`;
  if (status === "taken") return `${base} border-amber-300 focus:border-amber-500`;
  return `${base} border-brand-100 focus:border-brand-600`;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "checking") return <Loader2 className="animate-spin text-slate-400" size={17} />;
  if (status === "free") return <CheckCircle className="text-green-500" size={17} />;
  if (status === "taken") return <XCircle className="text-amber-500" size={17} />;
  return null;
}

interface Props {
  /** Center groups for the optional immediate-enroll select. */
  classes: ClassData[];
  onClose: () => void;
  /** Fired after a successful create so the page can refresh the roster. */
  onCreated?: () => void;
}

interface Created {
  email: string;
  username: string;
  password: string;
}

function CredentialRow({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} nusxalandi`);
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl">
      <Icon size={16} className="text-brand-600 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-[14px] font-bold text-slate-900 font-mono truncate">{value}</p>
      </div>
      <button type="button" onClick={copy} title="Nusxalash"
        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-brand-700 hover:bg-brand-50 transition-colors">
        <Copy size={16} />
      </button>
    </div>
  );
}

export default function CreateStudentModal({ classes, onClose, onCreated }: Props) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [classId, setClassId] = useState("");
  const [grade, setGrade] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [emailStatus, setEmailStatus] = useState<CheckStatus>("idle");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<CheckStatus>("idle");

  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const passwordAutoFilled = useRef(false);
  const usernameCache = useRef(new Map<string, boolean>());
  const emailCache = useRef(new Map<string, boolean>());

  const sortedClasses = [...classes].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

  // Live suggestions while the manager types the name.
  useEffect(() => {
    if (!emailTouched) setEmail(suggestTeacherEmail(fullName));
    if (!usernameTouched) setUsername(suggestTeacherUsername(fullName));
    if (!passwordAutoFilled.current && fullName.trim().length >= 3) {
      passwordAutoFilled.current = true;
      setPassword(generateFriendlyPassword(fullName));
    }
  }, [fullName, emailTouched, usernameTouched]);

  // Real-time availability — same signup-style pattern as CreateTeacherModal.
  useEffect(() => {
    if (!username || !USERNAME_REGEX.test(username)) {
      setUsernameStatus("idle");
      return;
    }
    const cached = usernameCache.current.get(username);
    if (cached !== undefined) {
      setUsernameStatus(cached ? "free" : "taken");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      try {
        const isUnique = await checkUsernameUnique(username);
        usernameCache.current.set(username, isUnique);
        setUsernameStatus(isUnique ? "free" : "taken");
      } catch {
        setUsernameStatus("free"); // fail open, like signup
      }
    }, 800);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    if (!email || !email.includes("@")) {
      setEmailStatus("idle");
      return;
    }
    const cached = emailCache.current.get(email);
    if (cached !== undefined) {
      setEmailStatus(cached ? "free" : "taken");
      return;
    }
    setEmailStatus("checking");
    const t = setTimeout(async () => {
      try {
        await lookupByEmail(email);
        emailCache.current.set(email, false);
        setEmailStatus("taken");
      } catch {
        setEmailStatus("free"); // 404 → free; transient errors fail open, uncached
      }
    }, 800);
    return () => clearTimeout(t);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 3) return setError("To'liq ismni kiriting.");
    if (password.length < 8) return setError("Parol kamida 8 belgidan iborat bo'lishi kerak.");
    if (usernameTouched && !USERNAME_REGEX.test(username)) {
      return setError("Username kamida 5 belgi, harf bilan boshlanishi kerak (a-z, 0-9, _).");
    }
    if (emailTouched && emailStatus === "taken") {
      return setError("Bu email allaqachon band. Boshqasini kiriting.");
    }
    if (usernameTouched && usernameStatus === "taken") {
      return setError("Bu username allaqachon band. Boshqasini kiriting.");
    }

    setSubmitting(true);
    try {
      const result = await managerApiFetch<Created & { uid: string }>("/api/manager/students/create", {
        method: "POST",
        body: {
          fullName: fullName.trim(),
          password,
          ...(emailTouched && email ? { email } : {}),
          ...(usernameTouched && username ? { username } : {}),
          ...(classId ? { classId } : {}),
          ...(grade ? { grade } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      });
      setCreated({ email: result.email, username: result.username, password: result.password });
      onCreated?.();
      toast.success("O'quvchi hisobi yaratildi!");
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyAll = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(
      `Login: ${created.username}\nEmail: ${created.email}\nParol: ${created.password}`,
    );
    toast.success("Barcha ma'lumotlar nusxalandi");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !submitting && onClose()}></div>
      <div className="relative bg-white w-full sm:max-w-md rounded-t-[1.75rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[94dvh] sm:max-h-[92vh] overflow-y-auto custom-scrollbar">

        {created ? (
          /* ── Success: hand these to the student ── */
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                <PartyPopper size={28} strokeWidth={2} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Hisob yaratildi!</h2>
              <p className="text-[13px] text-slate-500 mt-1">
                Bu ma&apos;lumotlarni o&apos;quvchiga bering. Parol keyin ham profil oynasida ko&apos;rinadi.
              </p>
            </div>

            <div className="space-y-2.5">
              <CredentialRow label="Username" value={created.username} icon={AtSign} />
              <CredentialRow label="Email" value={created.email} icon={Mail} />
              <CredentialRow label="Parol" value={created.password} icon={KeyRound} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={copyAll}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors">
                <Copy size={16} /> Nusxalash
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-full transition-colors shadow-sm shadow-brand-600/25">
                Tayyor
              </button>
            </div>
          </div>
        ) : (
          /* ── Create form ── */
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 shrink-0">
                <UserPlus size={24} strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Yangi o&apos;quvchi yaratish</h2>
                <p className="text-[13px] text-slate-500">Login va parol avtomatik tayyorlanadi.</p>
              </div>
              <button type="button" onClick={() => !submitting && onClose()}
                className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full transition-colors shrink-0">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div className="space-y-1.5">
                <label htmlFor="cs-name" className="text-[13px] font-bold text-slate-700 ml-1">To&apos;liq ism</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input id="cs-name" type="text" required autoFocus value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting} placeholder="Aziz Aliyev"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60" />
                </div>
              </div>

              {/* Password: visible, regenerable */}
              <div className="space-y-1.5">
                <label htmlFor="cs-password" className="text-[13px] font-bold text-slate-700 ml-1">Parol</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={18} />
                  </div>
                  <input id="cs-password" type="text" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting} placeholder="Kamida 8 belgi" minLength={8}
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold font-mono text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60" />
                  <button type="button" title="Yangi parol yaratish" disabled={submitting}
                    onClick={() => setPassword(generateFriendlyPassword(fullName || "edify student"))}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-brand-600 transition-colors">
                    <RefreshCw size={17} />
                  </button>
                </div>
              </div>

              {/* Optional immediate enroll */}
              <div className="space-y-1.5">
                <label htmlFor="cs-class" className="text-[13px] font-bold text-slate-700 ml-1">Guruhga qo&apos;shish (ixtiyoriy)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Layers size={18} />
                  </div>
                  <select id="cs-class" value={classId}
                    onChange={(e) => setClassId(e.target.value)} disabled={submitting}
                    className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all appearance-none disabled:opacity-60">
                    <option value="">Guruhsiz (keyin qo&apos;shiladi)</option>
                    {sortedClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Auto-generated login preview — signup-style live checks */}
              <div className="bg-brand-50/60 border border-brand-100 rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-black text-brand-700 uppercase tracking-widest">Avtomatik login</p>

                <div className="space-y-1">
                  <label htmlFor="cs-username" className="text-[11px] font-bold text-slate-500 ml-1">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-400">
                      <AtSign size={15} />
                    </div>
                    <input id="cs-username" type="text" value={username} disabled={submitting}
                      onChange={(e) => { setUsernameTouched(true); setUsername(e.target.value.toLowerCase().trim()); }}
                      placeholder="avtomatik"
                      className={statusBorder(usernameStatus, "w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-[13px] font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60")} />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <StatusIcon status={usernameStatus} />
                    </div>
                  </div>
                  {usernameStatus === "taken" && (
                    <p className="text-[11px] text-amber-500 font-bold ml-1">
                      Bu username band{usernameTouched ? " — boshqasini kiriting." : " — raqam qo'shilib yaratiladi."}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="cs-email" className="text-[11px] font-bold text-slate-500 ml-1">Email (tizimga kirish uchun)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-400">
                      <Mail size={15} />
                    </div>
                    <input id="cs-email" type="email" value={email} disabled={submitting}
                      onChange={(e) => { setEmailTouched(true); setEmail(e.target.value.toLowerCase().trim()); }}
                      placeholder="avtomatik"
                      className={statusBorder(emailStatus, "w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-[13px] font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60")} />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <StatusIcon status={emailStatus} />
                    </div>
                  </div>
                  {emailStatus === "taken" && (
                    <p className="text-[11px] text-amber-500 font-bold ml-1">
                      Bu email band{emailTouched ? " — boshqasini kiriting." : " — boshqa variant avtomatik tanlanadi."}
                    </p>
                  )}
                </div>
              </div>

              {/* Optional extras */}
              <button type="button" onClick={() => setShowOptional(!showOptional)}
                className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500 hover:text-brand-700 transition-colors ml-1">
                <ChevronDown size={15} className={`transition-transform ${showOptional ? "rotate-180" : ""}`} />
                Qo&apos;shimcha ma&apos;lumotlar (ixtiyoriy)
              </button>
              {showOptional && (
                <div className="space-y-4 animate-in slide-in-from-top-1 duration-150">
                  <div className="space-y-1.5">
                    <label htmlFor="cs-grade" className="text-[13px] font-bold text-slate-700 ml-1">Sinf</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <GraduationCap size={18} />
                      </div>
                      <select id="cs-grade" value={grade}
                        onChange={(e) => setGrade(e.target.value)} disabled={submitting}
                        className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all appearance-none disabled:opacity-60">
                        <option value="">Tanlanmagan</option>
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="cs-phone" className="text-[13px] font-bold text-slate-700 ml-1">Telefon</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                        <Phone size={18} />
                      </div>
                      <input id="cs-phone" type="tel" value={phone}
                        onChange={(e) => setPhone(e.target.value)} disabled={submitting}
                        placeholder="+998 90 123 45 67"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60" />
                    </div>
                  </div>
                  <p className="text-[12px] text-slate-400 ml-1">
                    Qolgan ma&apos;lumotlarni keyin o&apos;quvchi profilida tahrirlash mumkin.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-[13px] font-bold text-red-500 px-1 animate-in slide-in-from-top-1">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={submitting}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors disabled:opacity-60">
                  Bekor qilish
                </button>
                <button type="submit"
                  disabled={submitting || !fullName.trim() || password.length < 8 ||
                    (usernameTouched && usernameStatus === "taken") || (emailTouched && emailStatus === "taken")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-full transition-colors disabled:opacity-60 shadow-sm shadow-brand-600/25">
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Yaratilmoqda...
                    </>
                  ) : (
                    "Yaratish"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
