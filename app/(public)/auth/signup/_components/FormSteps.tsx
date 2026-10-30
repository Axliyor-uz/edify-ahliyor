"use client";

import { Loader2, CheckCircle, XCircle, GraduationCap, School, Eye, EyeOff, ArrowRight, ArrowLeft, ChevronRight, X, FileText, ShieldCheck, Building, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import type { SIGNUP_TRANSLATIONS } from "../page";
import { FloatField, FloatSelect, FieldError, type Tone } from "../../_components/Field";

type SignupT = (typeof SIGNUP_TRANSLATIONS)["uz"];
type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

// ── Shared validation / formatting helpers (all three signup wizards) ──

/** A field-level error the wizard shows inline under one input. */
export type FieldErr = { field: string; text: string } | null;

export const passwordError = (pwd: string, t: SignupT) => (pwd.length < 8 ? t.validation.pwdShort : null);

export const usernameFormatError = (u: string, t: SignupT) => {
  if (!u) return null;
  if (u.length < 5) return t.validation.usernameMin;
  if (!/^[a-zA-Z]/.test(u)) return t.validation.usernameLetter;
  if (!/^[a-zA-Z0-9_]+$/.test(u)) return t.validation.usernameChars;
  return null;
};

/**
 * Auth errors that belong to step 1 (email/password). The wizard jumps back to
 * step 1 and shows them under the right field instead of a toast at the end.
 */
export const step1ErrorFor = (code: string | undefined, t: SignupT): FieldErr => {
  if (code === "auth/email-already-in-use") return { field: "email", text: t.validation.emailTaken };
  if (code === "auth/invalid-email") return { field: "email", text: t.validation.invalidEmail };
  if (code === "auth/weak-password") return { field: "password", text: t.validation.weakPassword };
  return null;
};

/** Any input → "+998 XX XXX XX XX" (or "" when no local digits are left). */
export const formatUzPhone = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  // Only a pasted full number carries the country code; a 9-digit local
  // number may itself start with 998.
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return "";
  return "+998 " + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
};

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Center name → slug: Cyrillic transliterated, o'/g' apostrophes dropped, a-z0-9 joined by "-". */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[Ѐ-ӿ]/g, (c) => CYRILLIC[c] ?? "")
    .replace(/['‘’ʻʼ`]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isValidSlug = (s: string) => s.length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

/** Wait a moment on the "account created" screen before redirecting. */
export const pauseOnDone = () => new Promise((r) => setTimeout(r, 1100));

// ── Wizard chrome ──

// Students sign up most, so they come first. Colour lives on the icon only.
const ROLE_CARDS = [
  { role: "student", Icon: GraduationCap, icon: "bg-emerald-50 text-emerald-600" },
  { role: "teacher", Icon: School, icon: "bg-indigo-50 text-indigo-600" },
  { role: "manager", Icon: Building, icon: "bg-amber-50 text-amber-600" },
] as const;

// 🟢 STEP 0: ROLE SELECTION
export const Step0Role = ({ setRole, t }: { setRole: (r: "student" | "teacher" | "manager") => void; t: SignupT }) => (
  <div className="grid gap-3">
    {ROLE_CARDS.map(({ role, Icon, icon }) => (
      <button
        key={role}
        type="button"
        onClick={() => setRole(role)}
        className="group w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-[#E2E8F0] bg-white hover:border-[#1565C0] hover:bg-[#F8FAFC] transition-colors text-left active:scale-[0.99]"
      >
        <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${icon}`}>
          <Icon size={22} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-bold text-[#0F172A]">{t.roles[role].title}</span>
          <span className="block text-[13px] font-medium text-[#64748B] mt-0.5">{t.roles[role].desc}</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[#CBD5E1] group-hover:text-[#1565C0] group-hover:translate-x-0.5 transition" />
      </button>
    ))}
  </div>
);

/** "Step n of total" + title + a thin segmented progress bar. */
export const WizardHeader = ({ n, total, title, sub, t }: { n: number; total: number; title: string; sub?: string; t: SignupT }) => (
  <div className="mb-8">
    {total > 1 && (
      <p className="text-[12px] font-bold uppercase tracking-wider text-[#1565C0]">
        {t.steps.of.replace("{n}", String(n)).replace("{total}", String(total))}
      </p>
    )}
    <h1 className="text-[28px] font-black text-[#0F172A] tracking-tight leading-tight mt-1">{title}</h1>
    {sub && <p className="text-[#64748B] mt-1.5 text-[15px]">{sub}</p>}
    {total > 1 && (
      <div className="flex gap-1.5 mt-5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < n ? "bg-[#1565C0]" : "bg-[#E2E8F0]"}`} />
        ))}
      </div>
    )}
  </div>
);

export const WizardFooter = ({ onBack, loading, isLast, disabled, t }: { onBack: () => void; loading: boolean; isLast: boolean; disabled: boolean; t: SignupT }) => (
  <div className="flex gap-3 mt-8">
    <button
      type="button"
      onClick={onBack}
      className="px-5 py-3.5 rounded-xl font-bold text-[15px] text-[#475569] bg-white border-2 border-[#E2E8F0] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors flex items-center gap-2"
    >
      <ArrowLeft size={18} /> {t.buttons.back}
    </button>
    <button
      type="submit"
      disabled={disabled}
      className="flex-1 bg-[#1565C0] hover:bg-[#114E93] text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-[15px] shadow-sm shadow-[#1565C0]/25"
    >
      {loading ? <><Loader2 className="animate-spin" size={18} /> {t.buttons.creating}</>
        : isLast ? t.buttons.complete
        : <>{t.buttons.next} <ArrowRight size={18} /></>}
    </button>
  </div>
);

/** Shown for a moment after the account is created, before the redirect. */
export const SignupDone = ({ role, t }: { role: "student" | "teacher" | "manager"; t: SignupT }) => (
  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center py-10">
    <motion.div
      initial={{ scale: 0.5 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"
    >
      <CheckCircle size={34} />
    </motion.div>
    <h1 className="mt-5 text-[26px] font-black text-[#0F172A] tracking-tight">{t.done.title}</h1>
    <p className="mt-1.5 text-[15px] text-[#64748B]">{t.validation.welcome.replace("{role}", t.roleNames[role])}</p>
    <p className="mt-6 flex items-center gap-2 text-[13px] font-semibold text-[#94A3B8]">
      <Loader2 size={14} className="animate-spin" /> {t.done.redirecting}
    </p>
  </motion.div>
);

// Fades each wizard step in; keyed by step so it replays on every change.
export const StepFade = ({ step, children }: { step: number; children: React.ReactNode }) => (
  <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
    {children}
  </motion.div>
);

// 🟢 STEP 1: FAST AUTH (Email & Password)
export const Step1Auth = ({ formData, handleChange, showPassword, setShowPassword, fieldError, t }: {
  formData: { email: string; password: string }; handleChange: ChangeHandler; showPassword: boolean;
  setShowPassword: (v: boolean) => void; fieldError: FieldErr; t: SignupT;
}) => {
  const emailErr = fieldError?.field === "email" ? fieldError.text : null;
  const pwdErr = fieldError?.field === "password" ? fieldError.text : null;
  const pwdOk = formData.password.length >= 8;

  return (
    <div className="space-y-5">
      <div>
        <FloatField id="su-email" name="email" type="email" autoComplete="email" label={t.inputs.email} required value={formData.email} onChange={handleChange} tone={emailErr ? "error" : "idle"} autoFocus />
        <FieldError text={emailErr} />
      </div>

      <div>
        <FloatField
          id="su-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password"
          label={t.inputs.password} required value={formData.password} onChange={handleChange} tone={pwdErr ? "error" : "idle"}
          right={
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t.hints.hidePassword : t.hints.showPassword} className="hover:text-[#0F172A] transition-colors">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        {pwdErr ? (
          <FieldError text={pwdErr} />
        ) : (
          <p className={`flex items-center gap-1.5 text-[12px] font-semibold mt-2 px-1 transition-colors ${pwdOk ? "text-emerald-600" : "text-[#94A3B8]"}`}>
            {pwdOk ? <CheckCircle size={14} /> : <Circle size={14} />} {t.hints.passwordRule}
          </p>
        )}
      </div>
    </div>
  );
};

export const PolicyModal = ({ isOpen, onClose, title, content, icon: Icon, closeText }: any) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm shrink-0">
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <h2 className="text-[18px] md:text-xl font-black text-slate-900 tracking-tight">{title}</h2>
              </div>
              <button onClick={onClose} aria-label={closeText} className="p-2 bg-white text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors border border-slate-200">
                <X size={20} />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar bg-white">
              <div className="prose prose-slate prose-sm md:prose-base max-w-none text-slate-600">
                 {/* Agar tashqaridan 'content' prop uzatilsa, shu yerda ko'rsatishingiz ham mumkin. Hozircha statik matn: */}
                <p><strong>1. Kirish</strong><br/>Platformamizga xush kelibsiz. Bizning xizmatlarimizga kirish yoki ulardan foydalanish orqali siz ushbu shartlarga rioya qilishga rozilik bildirasiz.</p>
                <p><strong>2. Foydalanuvchi hisoblari</strong><br/>Siz parolingiz xavfsizligini ta'minlash uchun javobgarsiz. Parolingizni uchinchi shaxslarga oshkor qilmaslikka rozilik bildirasiz.</p>
                <p><strong>3. Ruxsat etilgan foydalanish</strong><br/>Siz xizmatlar yoki serverlar ishiga xalaqit beradigan yoki ularni buzadigan har qanday faoliyat bilan shug'ullanmaslikka rozilik bildirasiz.</p>
                <p><strong>4. Kontentga egalik huquqi</strong><br/>Siz taqdim etgan har qanday kontentga egalik huquqini saqlab qolasiz, ammo bizga undan foydalanish, saqlash va namoyish etish huquqini (litsenziya) berasiz.</p>
                <p><strong>5. Bekor qilish</strong><br/>Biz istalgan sababga ko'ra, oldindan ogohlantirmasdan yoki javobgarliksiz xizmatimizga kirishni darhol bekor qilishimiz yoki to'xtatib qo'yishimiz mumkin.</p>
                 <p><strong>6. Javobgarlik</strong><br/>Hech qanday holatda platforma har qanday bilvosita, tasodifiy, maxsus, oqibatli yoki jazo tarzidagi zararlar uchun javobgar bo'lmaydi.</p>
                 <br/><br/><br/><br/> {/* Skeykrolni sinash uchun qo'shimcha joy */}
                 <p><em>So'nggi marta yangilangan: 1-yanvar, 2026-yil</em></p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 md:p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end">
               <button onClick={onClose} className="px-6 py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-[14px]">
                 {closeText}
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};


// Terms checkbox + its two policy modals. Controlled (formData.agreed) so the
// tick survives going back a step.
export const TermsAgreement = ({ formData, handleChange, t }: { formData: { agreed: boolean }; handleChange: ChangeHandler; t: SignupT }) => {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
        <input type="checkbox" name="agreed" required checked={!!formData.agreed} onChange={handleChange} id="terms-checkbox" className="mt-0.5 w-5 h-5 rounded border-slate-300 text-[#1565C0] focus:ring-[#1565C0] cursor-pointer shadow-sm" />
        <label htmlFor="terms-checkbox" className="text-[13px] font-medium text-slate-600 leading-relaxed cursor-pointer select-none">
          {t.terms.text1}
          <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true); }} className="text-[#1565C0] font-bold hover:underline underline-offset-2">
            {t.terms.link1}
          </button>
          {t.terms.text2}
          <button type="button" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }} className="text-[#1565C0] font-bold hover:underline underline-offset-2">
            {t.terms.link2}
          </button>
          {t.terms.text3}
        </label>
      </div>

      <PolicyModal 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
        title={t.policyModals?.termsTitle || "Foydalanish Shartlari"} 
        closeText={t.policyModals?.close || "Yopish"}
        icon={FileText}
      />
      <PolicyModal 
        isOpen={showPrivacy} 
        onClose={() => setShowPrivacy(false)} 
        title={t.policyModals?.privacyTitle || "Maxfiylik Siyosati"} 
        closeText={t.policyModals?.close || "Yopish"}
        icon={ShieldCheck}
      />
    </>
  );
};

/** Username with live availability + the format rules shown up front, ticking green as they're met. */
export const UsernameField = ({ formData, handleChange, usernameError, usernameAvailable, isCheckingUser, t }: {
  formData: { username: string }; handleChange: ChangeHandler; usernameError: string | null;
  usernameAvailable: boolean | null; isCheckingUser: boolean; t: SignupT;
}) => {
  const u = formData.username.trim();
  const rules = [
    { ok: u.length >= 5, text: t.hints.usernameRules.min },
    { ok: /^[a-zA-Z]/.test(u), text: t.hints.usernameRules.letter },
    { ok: u.length > 0 && /^[a-zA-Z0-9_]+$/.test(u), text: t.hints.usernameRules.chars },
  ];
  const tone: Tone = usernameError ? "error" : usernameAvailable === true ? "success" : usernameAvailable === false ? "warn" : "idle";

  return (
    <div>
      <FloatField
        id="su-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
        label={t.inputs.username} required value={formData.username} onChange={handleChange} tone={tone}
        right={
          isCheckingUser ? <Loader2 className="animate-spin text-[#94A3B8]" size={18} />
          : usernameError ? <XCircle className="text-rose-500" size={18} />
          : usernameAvailable === true ? <CheckCircle className="text-emerald-500" size={18} />
          : usernameAvailable === false ? <XCircle className="text-amber-500" size={18} />
          : null
        }
      />
      {usernameAvailable === false ? (
        <p className="mt-2 px-1 text-[13px] font-semibold text-amber-600">{t.validation.userTaken}</p>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
          {rules.map((r) => (
            <span key={r.text} className={`flex items-center gap-1 text-[12px] font-semibold transition-colors ${r.ok ? "text-emerald-600" : "text-[#94A3B8]"}`}>
              {r.ok ? <CheckCircle size={13} /> : <Circle size={13} />} {r.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const SUBJECTS = ["matematika", "fizika", "kimyo", "biologiya", "ona_tili", "tarix", "ingliz_tili", "rus_tili", "informatika", "other"] as const;

// 🟢 STEP 2: FAST PROFILE
export const Step2Profile = ({ formData, handleChange, usernameError, usernameAvailable, isCheckingUser, role, t }: {
  formData: { fullName: string; username: string; gradeLevel?: string; schoolSubject?: string; agreed: boolean };
  handleChange: ChangeHandler; usernameError: string | null; usernameAvailable: boolean | null; isCheckingUser: boolean;
  role: "student" | "teacher"; t: SignupT;
}) => (
  <div className="space-y-5">
    <FloatField id="su-fullname" name="fullName" type="text" autoComplete="name" label={t.inputs.fullname} required value={formData.fullName} onChange={handleChange} autoFocus />

    <UsernameField formData={formData} handleChange={handleChange} usernameError={usernameError} usernameAvailable={usernameAvailable} isCheckingUser={isCheckingUser} t={t} />

    {role === "student" ? (
      <FloatSelect id="su-grade" name="gradeLevel" label={t.inputs.grade} value={formData.gradeLevel ?? ""} onChange={handleChange} required>
        {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={`school_${n}`}>{t.select.gradeN.replace("{n}", String(n))}</option>
        ))}
        <option value="uni">{t.select.uni}</option>
      </FloatSelect>
    ) : (
      <FloatSelect id="su-subject" name="schoolSubject" label={t.inputs.subject} value={formData.schoolSubject ?? ""} onChange={handleChange} required>
        {SUBJECTS.map((s) => (
          <option key={s} value={s}>{t.select.subjects[s]}</option>
        ))}
      </FloatSelect>
    )}

    <TermsAgreement formData={formData} handleChange={handleChange} t={t} />
  </div>
);
