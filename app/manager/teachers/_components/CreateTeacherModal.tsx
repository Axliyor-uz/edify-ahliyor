"use client";

/**
 * Manager creates a brand-new teacher account (docs/MANAGER.md § "Manager-
 * created teacher accounts"). Three required fields — name, subject, password —
 * everything else generated live (email from name + center slug, username from
 * the first name) and editable before submit. On success shows a credentials
 * card the manager hands to the teacher.
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
import {
  X, User, BookOpen, KeyRound, RefreshCw, Loader2, Copy,
  AtSign, Mail, Phone, ChevronDown, UserPlus, PartyPopper,
  CheckCircle, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

/** Real-time availability state, signup-page style. */
type CheckStatus = "idle" | "checking" | "free" | "taken";

/** Signup-style border tint for an availability-checked input. */
function statusBorder(status: CheckStatus, base: string): string {
  if (status === "free") return `${base} border-green-300 focus:border-green-500`;
  if (status === "taken") return `${base} border-amber-300 focus:border-amber-500`;
  return `${base} border-brand-100 focus:border-brand-600`;
}

/** Signup-style status icon rendered inside the input's right edge. */
function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "checking") return <Loader2 className="animate-spin text-slate-400" size={17} />;
  if (status === "free") return <CheckCircle className="text-green-500" size={17} />;
  if (status === "taken") return <XCircle className="text-amber-500" size={17} />;
  return null;
}

export const SUBJECT_OPTIONS = [
  { value: "matematika", label: "Matematika" },
  { value: "fizika", label: "Fizika" },
  { value: "kimyo", label: "Kimyo" },
  { value: "biologiya", label: "Biologiya" },
  { value: "ona_tili", label: "Ona tili va Adabiyot" },
  { value: "tarix", label: "Tarix" },
  { value: "ingliz_tili", label: "Ingliz tili" },
  { value: "rus_tili", label: "Rus tili" },
  { value: "informatika", label: "Informatika" },
  { value: "other", label: "Boshqa fan" },
];

interface Props {
  onClose: () => void;
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

export default function CreateTeacherModal({ onClose }: Props) {
  const [fullName, setFullName] = useState("");
  const [subject, setSubject] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // email/username: auto-suggested until the manager edits them by hand.
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
  // Signup-style in-memory caches — a value once checked isn't re-fetched.
  const usernameCache = useRef(new Map<string, boolean>());
  const emailCache = useRef(new Map<string, boolean>());

  // Live suggestions while the manager types the name.
  useEffect(() => {
    if (!emailTouched) setEmail(suggestTeacherEmail(fullName));
    if (!usernameTouched) setUsername(suggestTeacherUsername(fullName));
    if (!passwordAutoFilled.current && fullName.trim().length >= 3) {
      passwordAutoFilled.current = true;
      setPassword(generateFriendlyPassword(fullName));
    }
  }, [fullName, emailTouched, usernameTouched]);

  // Real-time username availability — same pattern as the signup wizards
  // (checkUsernameUnique + 800ms debounce + cache, fails open). The server
  // suffixes auto-generated names itself; this is UX, not the guard.
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

  // Real-time email availability via /api/directory/lookup (manager-allowed;
  // 404 = free). Auto-generated emails auto-fall-back server-side; explicit
  // ones would 409 — either way the manager sees it before submitting.
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
        // 404 → free; a transient error also lands here — fail open like
        // signup but do NOT cache it, so a retype re-checks for real.
        setEmailStatus("free");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 3) return setError("To'liq ismni kiriting.");
    if (!subject) return setError("Fanni tanlang.");
    if (password.length < 8) return setError("Parol kamida 8 belgidan iborat bo'lishi kerak.");
    if (usernameTouched && !USERNAME_REGEX.test(username)) {
      return setError("Username kamida 5 belgi, harf bilan boshlanishi kerak (a-z, 0-9, _).");
    }
    // Auto-generated values fall back server-side; explicit taken ones would 409.
    if (emailTouched && emailStatus === "taken") {
      return setError("Bu email allaqachon band. Boshqasini kiriting.");
    }
    if (usernameTouched && usernameStatus === "taken") {
      return setError("Bu username allaqachon band. Boshqasini kiriting.");
    }

    setSubmitting(true);
    try {
      const result = await managerApiFetch<Created & { uid: string }>("/api/manager/teachers/create", {
        method: "POST",
        body: {
          fullName: fullName.trim(),
          subject,
          password,
          // Only send overrides — omitted values let the server auto-suffix on collision.
          ...(emailTouched && email ? { email } : {}),
          ...(usernameTouched && username ? { username } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
      });
      setCreated({ email: result.email, username: result.username, password: result.password });
      toast.success("O'qituvchi hisobi yaratildi!");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !submitting && onClose()}></div>
      <div className="relative bg-white w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto custom-scrollbar">

        {created ? (
          /* ── Success: hand these to the teacher ── */
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-4">
                <PartyPopper size={28} strokeWidth={2} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Hisob yaratildi!</h2>
              <p className="text-[13px] text-slate-500 mt-1">
                Bu ma&apos;lumotlarni o&apos;qituvchiga bering. Parol keyin ham profil oynasida ko&apos;rinadi.
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
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Yangi hisob yaratish</h2>
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
                <label htmlFor="ct-name" className="text-[13px] font-bold text-slate-700 ml-1">To&apos;liq ism</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input id="ct-name" type="text" required autoFocus value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={submitting} placeholder="Alisher Karimov"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60" />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label htmlFor="ct-subject" className="text-[13px] font-bold text-slate-700 ml-1">Fani</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <BookOpen size={18} />
                  </div>
                  <select id="ct-subject" required value={subject}
                    onChange={(e) => setSubject(e.target.value)} disabled={submitting}
                    className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all appearance-none disabled:opacity-60">
                    <option value="" disabled>Fanni tanlang</option>
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              {/* Password: visible, regenerable */}
              <div className="space-y-1.5">
                <label htmlFor="ct-password" className="text-[13px] font-bold text-slate-700 ml-1">Parol</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <KeyRound size={18} />
                  </div>
                  <input id="ct-password" type="text" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting} placeholder="Kamida 8 belgi" minLength={8}
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold font-mono text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60" />
                  <button type="button" title="Yangi parol yaratish" disabled={submitting}
                    onClick={() => setPassword(generateFriendlyPassword(fullName || "edify teacher"))}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-brand-600 transition-colors">
                    <RefreshCw size={17} />
                  </button>
                </div>
              </div>

              {/* Auto-generated login preview — tap a field to override */}
              <div className="bg-brand-50/60 border border-brand-100 rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-black text-brand-700 uppercase tracking-widest">Avtomatik login</p>

                <div className="space-y-1">
                  <label htmlFor="ct-username" className="text-[11px] font-bold text-slate-500 ml-1">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-400">
                      <AtSign size={15} />
                    </div>
                    <input id="ct-username" type="text" value={username} disabled={submitting}
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
                  <label htmlFor="ct-email" className="text-[11px] font-bold text-slate-500 ml-1">Email (tizimga kirish uchun)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-400">
                      <Mail size={15} />
                    </div>
                    <input id="ct-email" type="email" value={email} disabled={submitting}
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
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-150">
                  <label htmlFor="ct-phone" className="text-[13px] font-bold text-slate-700 ml-1">Telefon</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Phone size={18} />
                    </div>
                    <input id="ct-phone" type="tel" value={phone}
                      onChange={(e) => setPhone(e.target.value)} disabled={submitting}
                      placeholder="+998 90 123 45 67"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-medium text-slate-900 outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-200 transition-all disabled:opacity-60" />
                  </div>
                  <p className="text-[12px] text-slate-400 ml-1 pt-1">
                    Qolgan ma&apos;lumotlarni keyin o&apos;qituvchi profilida tahrirlash mumkin.
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
                  disabled={submitting || !fullName.trim() || !subject || password.length < 8 ||
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
