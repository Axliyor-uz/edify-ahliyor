/**
 * FUTURE MAP — static career → subject roadmaps.
 *
 * Purely informational (no Firestore, no fetch): a hand-curated guide from
 * "what you study now" to "what a given major builds on", in order. Content
 * is a general guide, not one university's official curriculum — the page
 * says so (see TR.disclaimer in page.tsx).
 */

import type { LucideIcon } from "lucide-react";
import {
  Brain, Code2, Database, Lock, Server, ShieldCheck, Sigma, Terminal,
} from "lucide-react";

export type Lang3 = { uz: string; en: string; ru: string };

/** Roughly when a step is studied — drives both its badge label and color. */
export type Stage = "school" | "y1" | "y1_2" | "y2" | "y2_3" | "y3_4";

/** What kind of subject a step is — the tag a school pupil recognises from
 *  their own timetable (Math, Informatika…), shown next to the stage chip. */
export type Category = "math" | "programming" | "data" | "systems" | "security" | "ai";

export interface RoadmapStep {
  id: string;
  stage: Stage;
  category: Category;
  title: Lang3;
  /** One soft sentence — shown only when the student taps the step open. */
  desc: Lang3;
}

export interface Major {
  id: string;
  icon: LucideIcon;
  tone: "primary" | "secondary" | "tertiary" | "gold";
  name: Lang3;
  tagline: Lang3;
  steps: RoadmapStep[];
}

export const STAGE_LABELS: Record<Stage, Lang3> = {
  school: { uz: "Hozir maktabda", en: "At school now", ru: "Уже в школе" },
  y1: { uz: "1-kurs", en: "Year 1", ru: "1 курс" },
  y1_2: { uz: "1–2-kurs", en: "Year 1–2", ru: "1–2 курс" },
  y2: { uz: "2-kurs", en: "Year 2", ru: "2 курс" },
  y2_3: { uz: "2–3-kurs", en: "Year 2–3", ru: "2–3 курс" },
  y3_4: { uz: "3–4-kurs", en: "Year 3–4", ru: "3–4 курс" },
};

/** Chip color per stage — a gentle progression, not a per-major color. */
export const STAGE_STATUS: Record<Stage, "gold" | "primary" | "info" | "success"> = {
  school: "gold",
  y1: "primary",
  y1_2: "primary",
  y2: "info",
  y2_3: "info",
  y3_4: "success",
};

/** Icon + label + color per subject category — the main visual signal on
 *  each step, independent of which major it belongs to. `style` matches the
 *  literal class strings Tile/Chip already use for these tones, so Tailwind
 *  picks them up without any dynamic class construction. */
export const CATEGORY_META: Record<Category, { icon: LucideIcon; label: Lang3; style: string }> = {
  math: {
    icon: Sigma,
    label: { uz: "Matematika", en: "Math", ru: "Математика" },
    style: "bg-primary-container text-on-primary-container",
  },
  programming: {
    icon: Terminal,
    label: { uz: "Dasturlash", en: "Programming", ru: "Программирование" },
    style: "bg-secondary-container text-on-secondary-container",
  },
  data: {
    icon: Database,
    label: { uz: "Ma'lumotlar", en: "Data", ru: "Данные" },
    style: "bg-success-container text-on-success-container",
  },
  systems: {
    icon: Server,
    label: { uz: "Tizimlar", en: "Systems", ru: "Системы" },
    style: "bg-surface-container-high text-on-surface-variant",
  },
  security: {
    icon: Lock,
    label: { uz: "Xavfsizlik", en: "Security", ru: "Безопасность" },
    style: "bg-error-container text-on-error-container",
  },
  ai: {
    icon: Brain,
    label: { uz: "Sun'iy intellekt", en: "AI", ru: "ИИ" },
    style: "bg-gold-container text-on-gold-container",
  },
};

export const MAJORS: Major[] = [
  {
    id: "software-engineer",
    icon: Code2,
    tone: "primary",
    name: {
      uz: "Software muhandisi",
      en: "Software Engineer",
      ru: "Инженер-программист",
    },
    tagline: {
      uz: "Veb, mobil va tizimlarni quradi",
      en: "Builds the web, apps and systems around us",
      ru: "Создаёт сайты, приложения и системы вокруг нас",
    },
    steps: [
      {
        id: "algebra",
        stage: "school",
        category: "math",
        title: { uz: "Algebra va funksiyalar", en: "Algebra & Functions", ru: "Алгебра и функции" },
        desc: {
          uz: "Dasturlashning mantiqiy asosi: tengsizliklar, funksiyalar va grafiklar.",
          en: "The logical backbone of programming: inequalities, functions and graphs.",
          ru: "Логическая основа программирования: неравенства, функции и графики.",
        },
      },
      {
        id: "discrete-math",
        stage: "y1",
        category: "math",
        title: { uz: "Diskret matematika", en: "Discrete Mathematics", ru: "Дискретная математика" },
        desc: {
          uz: "To'plamlar, mantiq va graflar — algoritmlar aynan shu tilda isbotlanadi.",
          en: "Sets, logic and graphs — the language every algorithm proof is written in.",
          ru: "Множества, логика, графы — язык, на котором доказываются алгоритмы.",
        },
      },
      {
        id: "programming-basics",
        stage: "y1",
        category: "programming",
        title: {
          uz: "Dasturlash asoslari (Python/C++)",
          en: "Programming Fundamentals (Python/C++)",
          ru: "Основы программирования (Python/C++)",
        },
        desc: {
          uz: "Birinchi kod satrlari masalani bosqichma-bosqich yechish ko'nikmasini shakllantiradi.",
          en: "Your first lines of code build the habit of breaking a problem into steps.",
          ru: "Первые строки кода формируют навык решения задач по шагам.",
        },
      },
      {
        id: "dsa",
        stage: "y1_2",
        category: "programming",
        title: {
          uz: "Ma'lumotlar tuzilmalari va algoritmlar",
          en: "Data Structures & Algorithms",
          ru: "Структуры данных и алгоритмы",
        },
        desc: {
          uz: "Massiv, ro'yxat, daraxt — kod qanday tez va tejamli bo'lishini shu yerda o'rganasiz.",
          en: "Arrays, lists, trees — how code actually becomes fast and memory-efficient.",
          ru: "Массивы, списки, деревья — как код становится быстрым и экономным.",
        },
      },
      {
        id: "linear-algebra",
        stage: "y2",
        category: "math",
        title: { uz: "Chiziqli algebra", en: "Linear Algebra", ru: "Линейная алгебра" },
        desc: {
          uz: "Grafika, 3D va mashinali o'qitishning matematik tili.",
          en: "The math behind graphics, 3D engines and machine learning.",
          ru: "Математический язык графики, 3D и машинного обучения.",
        },
      },
      {
        id: "oop",
        stage: "y2",
        category: "programming",
        title: {
          uz: "Ob'ektga yo'naltirilgan dasturlash",
          en: "Object-Oriented Programming",
          ru: "Объектно-ориентированное программирование",
        },
        desc: {
          uz: "Katta loyihani bir-biri bilan ishlaydigan klasslarga bo'lib qurish san'ati.",
          en: "The art of splitting a big project into classes that work together.",
          ru: "Искусство делить большой проект на классы, которые работают вместе.",
        },
      },
      {
        id: "databases",
        stage: "y2",
        category: "data",
        title: { uz: "Ma'lumotlar bazalari (SQL)", en: "Databases (SQL)", ru: "Базы данных (SQL)" },
        desc: {
          uz: "Har bir ilova ma'lumotni qayerdadir saqlaydi — qanday saqlashni shu yerda bilib olasiz.",
          en: "Every app stores data somewhere — this is how, and why it matters.",
          ru: "Каждое приложение где-то хранит данные — здесь вы узнаёте, как именно.",
        },
      },
      {
        id: "systems",
        stage: "y3_4",
        category: "systems",
        title: {
          uz: "Tarmoqlar va tizim dizayni",
          en: "Networks & System Design",
          ru: "Сети и проектирование систем",
        },
        desc: {
          uz: "Millionlab foydalanuvchiga bir vaqtda xizmat qiladigan tizimlarni qurish mantiqi.",
          en: "The logic behind systems that serve millions of users at once.",
          ru: "Логика систем, которые обслуживают миллионы пользователей одновременно.",
        },
      },
    ],
  },
  {
    id: "ai-engineer",
    icon: Brain,
    tone: "tertiary",
    name: { uz: "AI muhandisi", en: "AI Engineer", ru: "Инженер по ИИ" },
    tagline: {
      uz: "Mashinalarni o'rganish va xulosa chiqarishga o'rgatadi",
      en: "Teaches machines to learn and reason",
      ru: "Учит машины обучаться и рассуждать",
    },
    steps: [
      {
        id: "calc1",
        stage: "school",
        category: "math",
        title: { uz: "Algebra va Calculus 1", en: "Algebra & Calculus 1", ru: "Алгебра и анализ 1" },
        desc: {
          uz: "Hosila va integralsiz zamonaviy AI algoritmlarini tushunib bo'lmaydi — hammasi shu yerdan boshlanadi.",
          en: "No derivative, no modern AI — this is where it all starts.",
          ru: "Без производной не понять современный ИИ — всё начинается здесь.",
        },
      },
      {
        id: "linear-algebra",
        stage: "y1",
        category: "math",
        title: { uz: "Chiziqli algebra", en: "Linear Algebra", ru: "Линейная алгебра" },
        desc: {
          uz: "Vektor va matritsalar — neyron tarmoqlarning ona tili.",
          en: "Vectors and matrices are the native language of neural networks.",
          ru: "Векторы и матрицы — родной язык нейронных сетей.",
        },
      },
      {
        id: "probability",
        stage: "y1",
        category: "math",
        title: { uz: "Ehtimollar nazariyasi", en: "Probability Theory", ru: "Теория вероятностей" },
        desc: {
          uz: "Model noaniqlikni qanday o'lchaydi — bu hammasi ehtimollikdan boshlanadi.",
          en: "How a model measures uncertainty — it all begins with probability.",
          ru: "Как модель измеряет неопределённость — всё начинается с вероятности.",
        },
      },
      {
        id: "python",
        stage: "y1",
        category: "programming",
        title: { uz: "Dasturlash (Python)", en: "Programming (Python)", ru: "Программирование (Python)" },
        desc: {
          uz: "AI dunyosining asosiy quroli — koddan tashqari model qurib bo'lmaydi.",
          en: "The core tool of AI — no model gets built without code.",
          ru: "Главный инструмент ИИ — без кода модель не построить.",
        },
      },
      {
        id: "statistics",
        stage: "y2",
        category: "math",
        title: { uz: "Statistika", en: "Statistics", ru: "Статистика" },
        desc: {
          uz: "Ma'lumotdagi naqsh haqiqiy yoki shunchaki tasodifiyligini ajratish san'ati.",
          en: "Telling a real pattern in data apart from pure chance.",
          ru: "Умение отличить реальную закономерность от случайности в данных.",
        },
      },
      {
        id: "calc2",
        stage: "y2",
        category: "math",
        title: {
          uz: "Calculus 2 (ko'p o'zgaruvchili)",
          en: "Calculus 2 (Multivariable)",
          ru: "Анализ 2 (многомерный)",
        },
        desc: {
          uz: "Gradient pasayish — modelni «o'qitish» aynan shu matematikaga tayanadi.",
          en: "Gradient descent — the math that actually 'trains' a model.",
          ru: "Градиентный спуск — математика, которая на самом деле «обучает» модель.",
        },
      },
      {
        id: "ml",
        stage: "y2_3",
        category: "ai",
        title: { uz: "Mashinali o'qitish", en: "Machine Learning", ru: "Машинное обучение" },
        desc: {
          uz: "Qoidalarni ma'lumotning o'zidan topadigan algoritmlar bilan ishlash.",
          en: "Algorithms that find their own rules inside data.",
          ru: "Алгоритмы, которые сами находят закономерности в данных.",
        },
      },
      {
        id: "deep-learning",
        stage: "y3_4",
        category: "ai",
        title: {
          uz: "Chuqur o'qitish, NLP va Computer Vision",
          en: "Deep Learning, NLP & Computer Vision",
          ru: "Глубокое обучение, NLP и Computer Vision",
        },
        desc: {
          uz: "Rasm tanish, matnni tushunish — neyron tarmoqlarning eng kuchli qo'llanilishi.",
          en: "Recognising images, understanding language — neural networks at their most powerful.",
          ru: "Распознавание изображений, понимание текста — нейросети на пике возможностей.",
        },
      },
    ],
  },
  {
    id: "data-scientist",
    icon: Database,
    tone: "secondary",
    name: { uz: "Data Scientist", en: "Data Scientist", ru: "Специалист по данным" },
    tagline: {
      uz: "Raqamlardan qiymatli xulosa chiqaradi",
      en: "Turns raw numbers into real insight",
      ru: "Превращает цифры в ценные выводы",
    },
    steps: [
      {
        id: "basic-stats",
        stage: "school",
        category: "math",
        title: {
          uz: "Algebra va statistika asoslari",
          en: "Algebra & Basic Statistics",
          ru: "Алгебра и основы статистики",
        },
        desc: {
          uz: "O'rtacha, median, foiz — ma'lumot bilan ishlashning birinchi tili.",
          en: "Mean, median, percentages — the first language of working with data.",
          ru: "Среднее, медиана, проценты — первый язык работы с данными.",
        },
      },
      {
        id: "calc1",
        stage: "y1",
        category: "math",
        title: { uz: "Calculus 1", en: "Calculus 1", ru: "Анализ 1" },
        desc: {
          uz: "O'zgarish tezligini tushunish — har qanday modelni baholashda kerak bo'ladi.",
          en: "Understanding rates of change — you'll need it to evaluate every model.",
          ru: "Понимание скорости изменения — пригодится для оценки любой модели.",
        },
      },
      {
        id: "linear-algebra",
        stage: "y1",
        category: "math",
        title: { uz: "Chiziqli algebra", en: "Linear Algebra", ru: "Линейная алгебра" },
        desc: {
          uz: "Minglab sonli jadvalni bitta vektor sifatida ko'rish imkonini beradi.",
          en: "Seeing a table of thousands of numbers as a single vector.",
          ru: "Таблица из тысяч чисел становится одним вектором.",
        },
      },
      {
        id: "probability",
        stage: "y1_2",
        category: "math",
        title: { uz: "Ehtimollar nazariyasi", en: "Probability Theory", ru: "Теория вероятностей" },
        desc: {
          uz: "Har bir bashorat — aslida ehtimollik haqida gapirishdir.",
          en: "Every prediction is, underneath, a statement about probability.",
          ru: "Любой прогноз — это, в сущности, утверждение о вероятности.",
        },
      },
      {
        id: "programming",
        stage: "y1_2",
        category: "programming",
        title: { uz: "Dasturlash (Python/R)", en: "Programming (Python/R)", ru: "Программирование (Python/R)" },
        desc: {
          uz: "Ma'lumotni tozalash, tahlil qilish va vizuallashtirish kodi.",
          en: "The code behind cleaning, analysing and visualising data.",
          ru: "Код для очистки, анализа и визуализации данных.",
        },
      },
      {
        id: "inference",
        stage: "y2",
        category: "math",
        title: { uz: "Statistik xulosa chiqarish", en: "Statistical Inference", ru: "Статистический вывод" },
        desc: {
          uz: "Kichik namunadan katta populatsiya haqida ishonchli xulosa chiqarish.",
          en: "Drawing a confident conclusion about a whole population from a small sample.",
          ru: "Уверенный вывод о целой популяции по небольшой выборке.",
        },
      },
      {
        id: "databases",
        stage: "y2",
        category: "data",
        title: { uz: "Ma'lumotlar bazalari va SQL", en: "Databases & SQL", ru: "Базы данных и SQL" },
        desc: {
          uz: "Million qatorli jadvaldan kerakli ma'lumotni so'rab olish san'ati.",
          en: "The art of pulling exactly what you need from a million-row table.",
          ru: "Искусство получить именно то, что нужно, из таблицы с миллионом строк.",
        },
      },
      {
        id: "ml-bigdata",
        stage: "y3_4",
        category: "ai",
        title: {
          uz: "Mashinali o'qitish va katta ma'lumotlar",
          en: "Machine Learning & Big Data",
          ru: "Машинное обучение и большие данные",
        },
        desc: {
          uz: "Xom ma'lumotni biznes uchun real qiymatga aylantiradigan yakuniy bosqich.",
          en: "The final step: turning raw data into real business value.",
          ru: "Финальный шаг: превращение сырых данных в реальную бизнес-ценность.",
        },
      },
    ],
  },
  {
    id: "cyber-security",
    icon: ShieldCheck,
    tone: "gold",
    name: { uz: "Kiberxavfsizlik mutaxassisi", en: "Cyber Security", ru: "Специалист по кибербезопасности" },
    tagline: {
      uz: "Tizim va ma'lumotlarni hujumdan himoya qiladi",
      en: "Defends systems and data from attack",
      ru: "Защищает системы и данные от атак",
    },
    steps: [
      {
        id: "discrete-math",
        stage: "school",
        category: "math",
        title: {
          uz: "Algebra va diskret matematika",
          en: "Algebra & Discrete Mathematics",
          ru: "Алгебра и дискретная математика",
        },
        desc: {
          uz: "Har qanday shifrlash algoritmining tagida sonlar nazariyasi va mantiq yotadi.",
          en: "Number theory and logic sit underneath every encryption algorithm.",
          ru: "В основе любого алгоритма шифрования — теория чисел и логика.",
        },
      },
      {
        id: "programming-basics",
        stage: "y1",
        category: "programming",
        title: { uz: "Dasturlash asoslari", en: "Programming Fundamentals", ru: "Основы программирования" },
        desc: {
          uz: "Hujum va himoyani tushunish uchun avval narsa qanday qurilganini bilish kerak.",
          en: "To understand attack and defence, you first need to know how things are built.",
          ru: "Чтобы понимать атаку и защиту, нужно знать, как всё устроено.",
        },
      },
      {
        id: "networks",
        stage: "y1",
        category: "systems",
        title: { uz: "Kompyuter tarmoqlari", en: "Computer Networks", ru: "Компьютерные сети" },
        desc: {
          uz: "Ma'lumot internetda qanday yuradi — har bir hujum shu yo'lni buzishdan boshlanadi.",
          en: "How data travels across the internet — and how attacks break that journey.",
          ru: "Как данные путешествуют по интернету — и как атаки нарушают этот путь.",
        },
      },
      {
        id: "os",
        stage: "y1_2",
        category: "systems",
        title: { uz: "Operatsion tizimlar", en: "Operating Systems", ru: "Операционные системы" },
        desc: {
          uz: "Ichida nima bo'layotganini bilmagan tizimni himoya qilib bo'lmaydi.",
          en: "You can't protect a system you don't understand from the inside.",
          ru: "Невозможно защитить систему, которую не понимаешь изнутри.",
        },
      },
      {
        id: "databases",
        stage: "y2",
        category: "data",
        title: { uz: "Ma'lumotlar bazalari va SQL", en: "Databases & SQL", ru: "Базы данных и SQL" },
        desc: {
          uz: "SQL in'ektsiya kabi hujumlarni tushunish uchun avval SQL'ni bilish shart.",
          en: "You can't understand SQL injection without first knowing SQL.",
          ru: "Нельзя понять SQL-инъекцию, не зная SQL.",
        },
      },
      {
        id: "cryptography",
        stage: "y2",
        category: "security",
        title: { uz: "Kriptografiya", en: "Cryptography", ru: "Криптография" },
        desc: {
          uz: "Ma'lumotni sir saqlashning matematik asosi — sonlar nazariyasiga tayanadi.",
          en: "The mathematical foundation of keeping data secret, rooted in number theory.",
          ru: "Математическая основа секретности данных — корни в теории чисел.",
        },
      },
      {
        id: "network-web-security",
        stage: "y2_3",
        category: "security",
        title: {
          uz: "Tarmoq va veb xavfsizligi",
          en: "Network & Web Security",
          ru: "Сетевая и веб-безопасность",
        },
        desc: {
          uz: "Jonli tizimlardagi zaif nuqtalarni topish va yopishni o'rganasiz.",
          en: "Learning to find — and close — real vulnerabilities in live systems.",
          ru: "Учимся находить и закрывать реальные уязвимости в живых системах.",
        },
      },
      {
        id: "ethical-hacking",
        stage: "y3_4",
        category: "security",
        title: { uz: "Etik xaker amaliyoti", en: "Ethical Hacking Practice", ru: "Практика этичного хакинга" },
        desc: {
          uz: "Ruxsat etilgan tartibda tizimga «hujum qilib», uni mustahkamlash amaliyoti.",
          en: "Attacking a system with permission, to make it stronger.",
          ru: "Атаковать систему с разрешения — чтобы сделать её сильнее.",
        },
      },
    ],
  },
];
