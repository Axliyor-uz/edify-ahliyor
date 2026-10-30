"use client";

import { useState, useContext, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword, signInWithCustomToken, sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getSsoReturnTo, completeSsoRedirect } from "@/lib/sso";
import { Loader2, Mail, User, ChevronRight, Eye, EyeOff, AlertCircle, MailCheck } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { LanguageContext } from "@/app/(public)/layout";
import GoogleAuthButton from "../_components/GoogleAuthButton";
import AuthShell from "../_components/AuthShell";
import { FloatField, LastUsedBadge } from "../_components/Field";
import { rememberLoginMethod, lastLoginMethod } from "../_components/lastLogin";
import { roleHome } from "../_components/roleHome";
import React from "react";

// --- 1. TRANSLATION DICTIONARY ---
const LOGIN_TRANSLATIONS = {
  uz: {
    welcomeHeader: "Xush kelibsiz",
    subHeader: "Edify hisobingizga kiring.",
    emailLabel: "Email yoki username",
    passwordLabel: "Parol",
    signInBtn: "Kirish",
    signingIn: "Kirilmoqda...",
    lastUsed: "Oxirgi marta",
    forgotPassLink: "Parolni unutdingizmi?",
    sending: "Yuborilmoqda...",
    noAccount: "Hisobingiz yo'qmi?",
    createOne: "Bepul hisob yarating",
    welcomeBack: "Xush kelibsiz, {name}!",
    invalidCred: "Email/username yoki parol noto'g'ri.",
    noUser: "Bu email bilan hisob topilmadi.",
    loginFail: "Kirishda xatolik. Qaytadan urinib ko'ring.",
    accNotFound: "Hisob topilmadi. Iltimos, avval ro'yxatdan o'ting.",
    enterEmail: "Parolni tiklash uchun email yoki username kiriting.",
    resetSent: "Tiklash havolasi yuborildi! Emailingizni tekshiring.",
    invalidEmail: "Noto'g'ri email manzili.",
    resetFail: "Havola yuborishda xatolik yuz berdi.",
    tooManyAttempts: "Urinishlar soni juda ko'p. Birozdan so'ng qayta urinib ko'ring.",
    showPassword: "Parolni ko'rsatish",
    hidePassword: "Parolni yashirish",
  },
  en: {
    welcomeHeader: "Welcome Back",
    subHeader: "Access your Edify account.",
    emailLabel: "Email or Username",
    passwordLabel: "Password",
    signInBtn: "Sign In",
    signingIn: "Signing in...",
    lastUsed: "Last used",
    forgotPassLink: "Forgot Password?",
    sending: "Sending...",
    noAccount: "Don't have an account?",
    createOne: "Create one for free",
    welcomeBack: "Welcome back, {name}!",
    invalidCred: "Invalid email/username or password.",
    noUser: "No account found with this email.",
    loginFail: "Login failed. Please try again.",
    accNotFound: "Account not found. Please Sign Up first to create your profile.",
    enterEmail: "Please enter your email or username to reset your password.",
    resetSent: "Password reset link sent! Check your email.",
    invalidEmail: "Invalid email address.",
    resetFail: "Failed to send reset link.",
    tooManyAttempts: "Too many attempts. Please try again later.",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  ru: {
    welcomeHeader: "С возвращением",
    subHeader: "Войдите в свой аккаунт Edify.",
    emailLabel: "Email или имя пользователя",
    passwordLabel: "Пароль",
    signInBtn: "Войти",
    signingIn: "Вход...",
    lastUsed: "В прошлый раз",
    forgotPassLink: "Забыли пароль?",
    sending: "Отправка...",
    noAccount: "Нет аккаунта?",
    createOne: "Создать бесплатно",
    welcomeBack: "С возвращением, {name}!",
    invalidCred: "Неверный email/логин или пароль.",
    noUser: "Аккаунт с таким email не найден.",
    loginFail: "Ошибка входа. Попробуйте снова.",
    accNotFound: "Аккаунт не найден. Пожалуйста, сначала зарегистрируйтесь.",
    enterEmail: "Введите email или имя пользователя для сброса пароля.",
    resetSent: "Ссылка для сброса отправлена! Проверьте почту.",
    invalidEmail: "Неверный формат email.",
    resetFail: "Не удалось отправить ссылку.",
    tooManyAttempts: "Слишком много попыток. Попробуйте позже.",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
  }
};

export default function LoginPage() {
  const router = useRouter();
  
  const context = useContext(LanguageContext) as { lang?: 'uz' | 'en' | 'ru'; setLang?: (l: 'uz'|'en'|'ru') => void };
  const lang = context?.lang || 'uz';
  const setLang = context?.setLang || (() => {});
  const t = LOGIN_TRANSLATIONS[lang] || LOGIN_TRANSLATIONS['uz'];

  const identifierRef = useRef<HTMLInputElement>(null);

  // One smart field: contains '@' → email login, otherwise username login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  // Shown inline under the fields instead of as toasts
  const [formError, setFormError] = useState<string | null>(null);
  const [resetNote, setResetNote] = useState<{ ok: boolean; text: string } | null>(null);
  // How this browser signed in last time — that option gets a "last used"
  // badge (read once; AuthProvider renders this page client-side only).
  const [lastMethod] = useState(lastLoginMethod);

  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  // SSO hand-off (see lib/sso.ts): a partner app sent the user here with
  // ?returnTo=. If a session is already restored, bounce straight back with
  // a custom token — the user never sees this page. The listener detaches
  // after the first emission so a manual login below isn't double-handled.
  const [ssoReturnTo, setSsoReturnTo] = useState<string | null>(null);
  useEffect(() => {
    const returnTo = getSsoReturnTo();
    if (!returnTo) return;
    setSsoReturnTo(returnTo);
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (user) completeSsoRedirect(returnTo);
    });
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setResetNote(null);
    try {
      const id = identifier.trim();
      let user;
      if (id.includes("@")) {
        user = (await signInWithEmailAndPassword(auth, id, password)).user;
      } else {
        // Username login: /api/auth/login resolves the username and verifies
        // the password server-side, returning a custom token (docs/AUTH.md).
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: id, password }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.token) {
          const err = new Error("Username login failed") as Error & { code?: string };
          err.code = res.status === 429 ? "auth/too-many-requests" : "auth/invalid-credential";
          throw err;
        }
        user = (await signInWithCustomToken(auth, data.token)).user;
      }
      rememberLoginMethod("password");
      // SSO: send the user back to the partner app instead of a dashboard
      if (ssoReturnTo && (await completeSsoRedirect(ssoReturnTo))) return;
      const tokenResult = await user.getIdTokenResult(true);
      if (tokenResult.claims.super_admin) {
        toast.dismiss();
        toast.success("Welcome to the Admin Console", { duration: 4000 });
        router.push("/admin");
        return;
      }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        // Auth account exists but onboarding never finished (e.g. a Google
        // sign-in abandoned mid-profile) — resume it instead of erroring.
        router.push("/auth/complete-profile");
        return;
      }
      const profile = userDoc.data();
      toast.dismiss();
      toast.success(t.welcomeBack.replace("{name}", profile.displayName || "User"), { duration: 4000 });
      router.push(roleHome(profile.role));
    } catch (error: any) {
      console.error(error);
      setLoading(false);
      if (error.code === "auth/invalid-credential") setFormError(t.invalidCred);
      else if (error.code === "auth/too-many-requests") setFormError(t.tooManyAttempts);
      else if (error.code === "auth/user-not-found") setFormError(t.noUser);
      else setFormError(t.loginFail);
    }
  };

  const handleForgotPassword = async () => {
    const id = identifier.trim();
    setFormError(null);
    if (!id) {
      identifierRef.current?.focus();
      setResetNote({ ok: false, text: t.enterEmail });
      return;
    }
    setResetLoading(true);
    setResetNote(null);
    try {
      if (id.includes("@")) {
        await sendPasswordResetEmail(auth, id);
      } else {
        // Resolved server-side; the response never says whether the username
        // exists (docs/AUTH.md), so success here means "sent if it exists".
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: id }),
        });
        if (!res.ok) {
          const err = new Error("Reset failed") as Error & { code?: string };
          if (res.status === 429) err.code = "auth/too-many-requests";
          throw err;
        }
      }
      setResetNote({ ok: true, text: t.resetSent });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') setResetNote({ ok: false, text: t.noUser });
      else if (error.code === 'auth/invalid-email') setResetNote({ ok: false, text: t.invalidEmail });
      else if (error.code === 'auth/too-many-requests') setResetNote({ ok: false, text: t.tooManyAttempts });
      else setResetNote({ ok: false, text: t.resetFail });
    } finally {
      setResetLoading(false);
    }
  };

  const isUsernameInput = identifier.length > 0 && !identifier.includes("@");

  return (
    <AuthShell lang={lang} setLang={setLang}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8">
          <h1 className="text-[32px] font-black text-[#0F172A] tracking-tight leading-tight">
            {t.welcomeHeader}
          </h1>
          <p className="text-[#64748B] mt-1.5 text-[15px] font-normal leading-relaxed">
            {t.subHeader}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email or username */}
          <FloatField
            ref={identifierRef}
            id="login-identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            label={t.emailLabel}
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); setFormError(null); setResetNote(null); }}
            tone={formError ? 'error' : 'idle'}
            right={isUsernameInput ? <User size={18} /> : <Mail size={18} />}
          />

          {/* Password */}
          <div>
            <FloatField
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              label={t.passwordLabel}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
              onKeyDown={handleKeyEvent}
              onKeyUp={handleKeyEvent}
              aria-describedby={formError ? "login-error" : undefined}
              tone={formError ? 'error' : 'idle'}
              right={
                <>
                  {capsLockActive && (
                    <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded tracking-tighter animate-pulse pointer-events-none select-none">
                      CAPS
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                    className="hover:text-[#0F172A] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </>
              }
            />

            {formError && (
              <p id="login-error" role="alert" className="flex items-center gap-1.5 mt-2 px-1 text-[13px] font-semibold text-rose-600">
                <AlertCircle size={15} className="shrink-0" /> {formError}
              </p>
            )}
          </div>

          {/* Forgot password */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-[13px] font-bold text-[#1565C0] hover:text-[#0D47A1] transition-colors disabled:opacity-50"
            >
              {resetLoading ? t.sending : t.forgotPassLink}
            </button>
          </div>

          {resetNote && (
            <p
              role="status"
              className={`flex items-start gap-2 px-3.5 py-3 rounded-xl text-[13px] font-semibold leading-snug ${
                resetNote.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {resetNote.ok ? <MailCheck size={16} className="shrink-0 mt-px" /> : <AlertCircle size={16} className="shrink-0 mt-px" />}
              {resetNote.text}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full bg-[#1565C0] hover:bg-[#114E93] text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 text-[15px] shadow-sm shadow-[#1565C0]/25 mt-2"
          >
            {lastMethod === 'password' && !loading && <LastUsedBadge text={t.lastUsed} />}
            {loading ? <><Loader2 className="animate-spin" size={18} /> {t.signingIn}</> : <>{t.signInBtn} <ChevronRight size={18} /></>}
          </button>
        </form>

        {/* New Google users are routed to /auth/complete-profile to pick a
            role and username — no password is ever asked for them */}
        <GoogleAuthButton lang={lang} lastUsed={lastMethod === "google"} />

        <div className="mt-10 pt-6 border-t border-[#E2E8F0] text-center text-[14px] text-[#64748B]">
          {t.noAccount}{' '}
          <Link href={ssoReturnTo ? `/auth/signup?returnTo=${encodeURIComponent(ssoReturnTo)}` : "/auth/signup"} className="text-[#1565C0] font-bold hover:underline">
            {t.createOne}
          </Link>
        </div>
      </motion.div>
    </AuthShell>
  );
}
