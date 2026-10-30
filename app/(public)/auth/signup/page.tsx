"use client";

import { useState, useContext } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageContext } from "@/app/(public)/layout";
import { getSsoReturnTo } from "@/lib/sso";
import { Step0Role } from "./_components/FormSteps";
import TeacherSignupFlow from "./_components/TeacherSignupFlow";
import StudentSignupFlow from "./_components/StudentSignupFlow";
import ManagerSignupFlow from "./_components/ManagerSignupFlow";
import GoogleAuthButton from "../_components/GoogleAuthButton";
import AuthShell from "../_components/AuthShell";

// --- 1. TURBO TRANSLATION DICTIONARY ---
export const SIGNUP_TRANSLATIONS = {
  uz: {
    steps: {
      0: { title: "Yo'nalishni tanlang", sub: "O'qishni xohlaysizmi yoki o'qitishni?" },
      1: { title: "Hisob yaratish" },
      2: { title: "Shaxsiy ma'lumotlar" },
      center: { title: "Markaz profilini yarating" },
      of: "{n} / {total} qadam",
      google: { title: "Profilni to'ldiring", sub: "Google hisobingiz ulandi — parol kerak emas" }
    },
    roles: {
      student: { title: "Men O'quvchiman", desc: "Fanlarni o'rganing va XP yig'ing" },
      teacher: { title: "Men O'qituvchiman", desc: "Testlar yarating, sinflarni boshqaring" },
      manager: { title: "Men Menejerman", desc: "O'quv markazingizni boshqaring" }
    },
    roleNames: { student: "O'quvchi", teacher: "Ustoz", manager: "Menejer" },
    inputs: { email: "Email manzili", username: "Foydalanuvchi nomi", password: "Parol", fullname: "To'liq ism (F.I.O)", phone: "Telefon raqam", centerName: "Markaz nomi", centerSlug: "Markaz havolasi", studentCount: "O'quvchilar soni", grade: "Sinf / Kurs", subject: "Asosiy fan" },
    hints: {
      passwordRule: "Kamida 8 ta belgi",
      showPassword: "Parolni ko'rsatish",
      hidePassword: "Parolni yashirish",
      slug: "Nomdan avtomatik yaratiladi. Faqat a-z, 0-9 va \"-\".",
      phone: "Masalan: 90 123 45 67",
      usernameRules: { min: "5+ belgi", letter: "Harf bilan boshlanadi", chars: "a-z, 0-9, _" }
    },
    select: {
      gradeN: "{n}-sinf",
      uni: "Universitet / Boshqa",
      subjects: { matematika: "Matematika", fizika: "Fizika", kimyo: "Kimyo", biologiya: "Biologiya", ona_tili: "Ona tili va Adabiyot", tarix: "Tarix", ingliz_tili: "Ingliz tili", rus_tili: "Rus tili", informatika: "Informatika", other: "Boshqa fan" }
    },
    buttons: { next: "Keyingi qadam", back: "Ortga", complete: "Ro'yxatdan o'tish", creating: "Yaratilmoqda...", loginLink: "Hisobingiz bormi? Kirish" },
    done: { title: "Hisob yaratildi!", redirecting: "Yo'naltirilmoqda..." },
    validation: {
      fillAll: "Iltimos, barcha maydonlarni to'ldiring.",
      userTaken: "Bu nom band qilingan.",
      welcome: "Xush kelibsiz, {role}!",
      pwdShort: "Parol kamida 8 ta belgidan iborat bo'lishi kerak.",
      usernameMin: "Kamida 5 ta belgi.",
      usernameLetter: "Harf bilan boshlanishi kerak.",
      usernameChars: "Faqat a-z, 0-9 va _ ruxsat etiladi.",
      phone: "Telefon formati: +998 XX XXX XX XX",
      slug: "Kamida 3 ta belgi: faqat a-z, 0-9 va \"-\".",
      emailTaken: "Bu email bilan hisob allaqachon mavjud. Boshqa email kiriting yoki tizimga kiring.",
      invalidEmail: "Email manzili noto'g'ri.",
      weakPassword: "Parol juda oddiy. Kuchliroq parol tanlang.",
      generic: "Xatolik yuz berdi. Qaytadan urinib ko'ring.",
      sessionExpired: "Sessiya tugadi. Qaytadan kiring.",
      alreadyRegistered: "Bu hisob allaqachon ro'yxatdan o'tgan."
    },
    terms: {
      text1: "Men qabul qilaman: ",
      link1: "Foydalanish shartlari",
      text2: " va ",
      link2: "Maxfiylik siyosatiga",
      text3: "."
    },
    policyModals: {
      termsTitle: "Foydalanish Shartlari",
      privacyTitle: "Maxfiylik Siyosati",
      close: "Yopish"
    }
  },
  en: {
    steps: {
      0: { title: "Choose your path", sub: "Are you learning or teaching?" },
      1: { title: "Create Account" },
      2: { title: "Personal Details" },
      center: { title: "Create your center profile" },
      of: "Step {n} of {total}",
      google: { title: "Complete your profile", sub: "Your Google account is connected — no password needed" }
    },
    roles: {
      student: { title: "I am a Student", desc: "Learn subjects and earn XP" },
      teacher: { title: "I am a Teacher", desc: "Create tests and manage classes" },
      manager: { title: "I am a Manager", desc: "Run your learning center" }
    },
    roleNames: { student: "Student", teacher: "Teacher", manager: "Manager" },
    inputs: { email: "Email Address", username: "Username", password: "Password", fullname: "Full Name", phone: "Phone Number", centerName: "Center Name", centerSlug: "Center link", studentCount: "Student Count", grade: "Grade / Course", subject: "Main subject" },
    hints: {
      passwordRule: "At least 8 characters",
      showPassword: "Show password",
      hidePassword: "Hide password",
      slug: "Made from the name automatically. Only a-z, 0-9 and \"-\".",
      phone: "For example: 90 123 45 67",
      usernameRules: { min: "5+ characters", letter: "Starts with a letter", chars: "a-z, 0-9, _" }
    },
    select: {
      gradeN: "Grade {n}",
      uni: "University / Other",
      subjects: { matematika: "Mathematics", fizika: "Physics", kimyo: "Chemistry", biologiya: "Biology", ona_tili: "Native language & Literature", tarix: "History", ingliz_tili: "English", rus_tili: "Russian", informatika: "Computer Science", other: "Other subject" }
    },
    buttons: { next: "Next Step", back: "Back", complete: "Complete Registration", creating: "Creating...", loginLink: "Already have an account? Log in" },
    done: { title: "Account created!", redirecting: "Redirecting..." },
    validation: {
      fillAll: "Please fill in all fields.",
      userTaken: "Username is taken.",
      welcome: "Welcome, {role}!",
      pwdShort: "Password must be at least 8 characters.",
      usernameMin: "At least 5 characters.",
      usernameLetter: "Must start with a letter.",
      usernameChars: "Only a-z, 0-9 and _ are allowed.",
      phone: "Phone format: +998 XX XXX XX XX",
      slug: "At least 3 characters: only a-z, 0-9 and \"-\".",
      emailTaken: "An account with this email already exists. Use another email or log in.",
      invalidEmail: "Invalid email address.",
      weakPassword: "Password is too weak. Choose a stronger one.",
      generic: "Something went wrong. Please try again.",
      sessionExpired: "Session expired. Please log in again.",
      alreadyRegistered: "This account is already registered."
    },
    terms: {
      text1: "I agree to the ",
      link1: "Terms of Service",
      text2: " and ",
      link2: "Privacy Policy",
      text3: "."
    },
    policyModals: {
      termsTitle: "Terms of Service",
      privacyTitle: "Privacy Policy",
      close: "Close"
    }
  },
  ru: {
    steps: {
      0: { title: "Выберите путь", sub: "Вы учитесь или преподаете?" },
      1: { title: "Создать аккаунт" },
      2: { title: "Личные данные" },
      center: { title: "Создайте профиль центра" },
      of: "Шаг {n} из {total}",
      google: { title: "Заполните профиль", sub: "Аккаунт Google подключён — пароль не нужен" }
    },
    roles: {
      student: { title: "Я Ученик", desc: "Изучайте предметы и получайте XP" },
      teacher: { title: "Я Учитель", desc: "Создавайте тесты и ведите классы" },
      manager: { title: "Я Менеджер", desc: "Управляйте учебным центром" }
    },
    roleNames: { student: "Ученик", teacher: "Учитель", manager: "Менеджер" },
    inputs: { email: "Эл. почта", username: "Имя пользователя", password: "Пароль", fullname: "Ф.И.О", phone: "Телефон", centerName: "Название центра", centerSlug: "Ссылка центра", studentCount: "Кол-во учеников", grade: "Класс / Курс", subject: "Основной предмет" },
    hints: {
      passwordRule: "Минимум 8 символов",
      showPassword: "Показать пароль",
      hidePassword: "Скрыть пароль",
      slug: "Создаётся из названия автоматически. Только a-z, 0-9 и \"-\".",
      phone: "Например: 90 123 45 67",
      usernameRules: { min: "5+ символов", letter: "Начинается с буквы", chars: "a-z, 0-9, _" }
    },
    select: {
      gradeN: "{n} класс",
      uni: "Университет / Другое",
      subjects: { matematika: "Математика", fizika: "Физика", kimyo: "Химия", biologiya: "Биология", ona_tili: "Родной язык и литература", tarix: "История", ingliz_tili: "Английский язык", rus_tili: "Русский язык", informatika: "Информатика", other: "Другой предмет" }
    },
    buttons: { next: "Далее", back: "Назад", complete: "Завершить", creating: "Создание...", loginLink: "Уже есть аккаунт? Войти" },
    done: { title: "Аккаунт создан!", redirecting: "Перенаправление..." },
    validation: {
      fillAll: "Пожалуйста, заполните все поля.",
      userTaken: "Имя пользователя занято.",
      welcome: "Добро пожаловать, {role}!",
      pwdShort: "Пароль должен содержать минимум 8 символов.",
      usernameMin: "Минимум 5 символов.",
      usernameLetter: "Должно начинаться с буквы.",
      usernameChars: "Только a-z, 0-9 и _.",
      phone: "Формат телефона: +998 XX XXX XX XX",
      slug: "Минимум 3 символа: только a-z, 0-9 и \"-\".",
      emailTaken: "Аккаунт с этим email уже существует. Укажите другой email или войдите.",
      invalidEmail: "Неверный формат email.",
      weakPassword: "Слишком простой пароль. Выберите посложнее.",
      generic: "Произошла ошибка. Попробуйте снова.",
      sessionExpired: "Сессия истекла. Войдите снова.",
      alreadyRegistered: "Этот аккаунт уже зарегистрирован."
    },
    terms: {
      text1: "Я согласен с ",
      link1: "Условиями использования",
      text2: " и ",
      link2: "Политикой конфиденциальности",
      text3: "."
    },
    policyModals: {
      termsTitle: "Условия Использования",
      privacyTitle: "Политика Конфиденциальности",
      close: "Закрыть"
    }
  }
};

export default function SignupPage() {
  const context = useContext(LanguageContext) as { lang?: 'uz' | 'en' | 'ru'; setLang?: (l: 'uz'|'en'|'ru') => void };
  const lang = context?.lang || 'uz';
  const setLang = context?.setLang || (() => {});
  const t = SIGNUP_TRANSLATIONS[lang] || SIGNUP_TRANSLATIONS['uz'];

  const [role, setRole] = useState<"student" | "teacher" | "manager" | null>(null);

  // Keep a partner's SSO hand-off (?returnTo=) when the user hops to login
  // (read once on mount; AuthProvider only renders this page client-side, after
  // the first auth emission, so there is no server HTML to mismatch)
  const [ssoReturnTo] = useState(getSsoReturnTo);
  const [haveAccount, loginWord] = t.buttons.loginLink.split('?');

  return (
    <AuthShell lang={lang} setLang={setLang}>
      <div className="w-full max-w-[480px]">
        <AnimatePresence mode="wait">
          {!role && (
            <motion.div key="step0" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <div className="mb-8">
                <h1 className="text-[28px] font-black text-[#0F172A] tracking-tight leading-tight">{t.steps[0].title}</h1>
                <p className="text-[#64748B] mt-1.5 text-[15px] font-medium">{t.steps[0].sub}</p>
              </div>
              <Step0Role setRole={setRole} t={t} />
              {/* New Google users finish onboarding (role, username, …) at
                  /auth/complete-profile; existing ones go straight to their dashboard */}
              <GoogleAuthButton lang={lang} />
              <p className="mt-8 text-center text-[14px] font-medium text-slate-500">
                {haveAccount}?
                <Link
                  href={ssoReturnTo ? `/auth/login?returnTo=${encodeURIComponent(ssoReturnTo)}` : "/auth/login"}
                  className="text-[#1565C0] font-bold hover:underline underline-offset-4 ml-1.5"
                >
                  {loginWord?.trim()}
                </Link>
              </p>
            </motion.div>
          )}

          {role === "teacher" && (
            <motion.div key="teacher" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <TeacherSignupFlow onBack={() => setRole(null)} t={t} />
            </motion.div>
          )}

          {role === "student" && (
            <motion.div key="student" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <StudentSignupFlow onBack={() => setRole(null)} t={t} />
            </motion.div>
          )}

          {role === "manager" && (
            <motion.div key="manager" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <ManagerSignupFlow onBack={() => setRole(null)} t={t} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthShell>
  );
}
