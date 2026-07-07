# 🗺️ MathMaster (Edify Student) - Full Project Documentation

This document provides a comprehensive overview of the MathMaster (Edify Student) platform, detailing the complete directory structure, all functionalities, and all pages available for Students, Teachers, and Administrators.

---

## 📂 1. Project Directory Structure

```text
edify-student/
├── app/
│   ├── (public)/              # Public & Marketing Pages
│   │   ├── auth/login/        # Login screen
│   │   ├── auth/signup/       # Registration screen
│   │   └── page.tsx           # Landing Page
│   │
│   ├── (student)/             # 🎓 STUDENT MODULE
│   │   ├── dashboard/         # Student Dashboard (Stats, Streaks, Daily Goals)
│   │   ├── classes/           # Enrolled classes & Classroom overview
│   │   │   └── [classId]/test/ # Taking tests & Viewing results
│   │   ├── explore/           # Find teachers and courses
│   │   ├── games/             # Educational math games (e.g., Checkers)
│   │   ├── history/           # Past quiz records & attempt history
│   │   ├── ielts/             # Student IELTS preparation module
│   │   ├── leaderboard/       # Rank tables (Daily, Weekly, Monthly, All-time)
│   │   ├── library/           # Online Library (Textbooks & Resources)
│   │   ├── notifications/     # System and class alerts
│   │   ├── profile/           # User profile & achievements
│   │   ├── settings/          # Account settings
│   │   └── student/exam/      # Quiz Interface, Adaptive Test Arena & Review
│   │
│   ├── teacher/               # 👨‍🏫 TEACHER MODULE
│   │   ├── dashboard/         # Teacher Dashboard (Stats, Subscription, AI Limits)
│   │   ├── create/            # Test Creation Hub (Studio 2.0)
│   │   │   ├── bsb-chsb/      # Official term exams generator
│   │   │   ├── maktab/        # Public school textbook quizzes
│   │   │   ├── ixtisoslashtirilgan_maktab/ # Olympiad logic problems
│   │   │   ├── abiturient/    # DTM Entrance Exam blocks
│   │   │   ├── operations/    # Math operations PDF worksheets
│   │   │   ├── by_image/      # AI Scanner (Image to Test)
│   │   │   ├── by_user_input/ # AI Prompt Generator
│   │   │   ├── custom/        # Manual test creation (Blank Canvas)
│   │   │   └── my_questions/  # Question Bank (Database)
│   │   ├── classes/           # Class rosters, student management, grading
│   │   ├── library/           # Teacher's saved tests, assessments & materials
│   │   ├── analytics/         # Performance tracking and analytics
│   │   ├── ielts/             # IELTS Groups & Reading materials management
│   │   ├── online-books/      # Access to educational literature
│   │   ├── print/             # Printing utilities for worksheets
│   │   ├── notifications/     # Teacher notifications
│   │   ├── profile/           # Teacher profile
│   │   ├── settings/          # Configuration and preferences
│   │   ├── students/          # Detailed view of individual students
│   │   └── subscription/      # Subscription plans (Free, Pro, VIP)
│   │
│   └── admin/                 # 🛡️ ADMIN MODULE
│       ├── classes/           # Manage all classes across the platform
│       ├── membership/        # Manage platform memberships and limits
│       ├── students/          # Manage all student accounts
│       └── teachers/          # Manage all teacher accounts
│
├── components/                # Reusable UI components (Navbar, Modals, KaTeX renderers)
├── lib/                       # Firebase configs, Auth Context, API helpers
├── services/                  # Business logic (quizService, userService, ieltsService)
├── hooks/                     # Custom React Hooks (AI Limits, Subscriptions)
├── types/                     # TypeScript Interfaces
├── utils/                     # Formatting utilities (LaTeX parsers, Dates)
└── data/                      # Static JSON datasets (Syllabus, Books)
```

---

## 🎓 2. Student Functionality & Pages

The student module is designed for engagement, gamification, and effective learning tracking.

### Core Pages & Features:
1. **Dashboard (`/dashboard`)**:
   - **Tactile Stats**: Displays Total XP, Current Streak (Days), Level, and Daily Goal progress.
   - **Recent Activity**: Zero-cost recent test history with scores and dates.
   - **Activity Heatmap**: A 7-day rolling area chart tracking daily XP gains.
   - **Daily Goals**: Interactive modal to set XP targets (Casual, Regular, Serious, Insane).
2. **Classes & Tests (`/classes`)**:
   - View enrolled classrooms.
   - Take assignments and tests (`/classes/[classId]/test/[assignmentId]`).
   - Post-quiz scorecard overlays showing correct ratios, time spent, and earned XP.
3. **Exam Arena (`/student/exam`)**:
   - Live testing interface with timer ticks, question counters, and KaTeX rendering for math formulas.
   - Adaptive testing capabilities.
   - **Review System (`/review`)**: Step-by-step breakdown of incorrect answers.
4. **Gamification & Leaderboard (`/leaderboard`)**:
   - Ranked tables filtered by Daily, Weekly, Monthly, and All-Time buckets.
   - Dynamic topic locks (padlocks on chapters) forcing sequential progression.
5. **Additional Modules**:
   - **History (`/history`)**: Scrolling log of all past attempts.
   - **Library (`/library`)**: Access to international and local textbook collections.
   - **Games (`/games`)**: Educational activities like Checkers.
   - **Explore (`/explore`)**: Directory to find teachers and new classes.

---

## 👨‍🏫 3. Teacher Functionality & Pages

The teacher module acts as a "Creation Hub" to easily generate, manage, and analyze assessments.

### Core Pages & Features:
1. **Teacher Dashboard (`/dashboard`)**:
   - **Stats Overview**: Counters for active students, active classes, and total tests created.
   - **Subscription & AI Limits**: Tracks plan status (Start, Pro, VIP) and Monthly AI usage.
   - **Quick Access**: Direct links to creation tools and management hubs.
2. **Test Creation Hub ("Studio 2.0") (`/create`)**:
   - **Curriculum Exams**:
     - *BSB & CHSB*: Matrix-based official term exams.
     - *Public School (Maktab)*: Quick quizzes based on textbooks.
     - *Specialized (Ixtisoslashtirilgan)*: Olympiad-level logic multi-step problems.
     - *Entrance Exams (Abiturient)*: Highly competitive 5-subject block tests for university prep.
   - **Worksheets & Practice**:
     - *Math Operations*: Endless PDF worksheet generator for basic arithmetic.
   - **AI & Manual Tools**:
     - *Scanner (By Image)*: Snap a photo of an old test and let AI generate new variants.
     - *AI Prompt (By User Input)*: Describe a topic and let AI build the entire test.
     - *Blank Canvas (Custom)*: Write questions manually using a built-in math keyboard.
   - **Question Bank (`/my_questions`)**: Central repository for all saved and generated questions.
3. **Management Hub**:
   - **Classes (`/classes`)**: Manage rosters, view student leaderboards, and grade exams (`/grade`).
   - **Library (`/library`)**: Archive of all saved tests, assessments, and materials.
   - **Analytics (`/analytics`)**: Detailed performance tracking and class averages.
   - **IELTS Integration (`/ielts`)**: Manage IELTS reading groups and manual reading tests.
4. **Monetization & Plans (`/subscription`)**:
   - View current limits, start 30-day free trials, and upgrade to unlock unlimited AI queries and BSB generators.

---

## 🛡️ 4. Admin Functionality & Pages

The admin panel provides top-level control over the platform's ecosystem.

### Core Pages & Features:
1. **User Management**:
   - **Teachers (`/admin/teachers`)**: Approve, edit, or remove teacher accounts. View detailed teacher overviews.
   - **Students (`/admin/students`)**: Manage student accounts and resolve issues.
2. **Platform Management**:
   - **Classes (`/admin/classes`)**: Oversee all active classes on the platform.
   - **Membership (`/admin/membership`)**: Control billing, adjust plan limits, and manage tier access globally.

---

## ⚙️ 5. Technology Stack & Integrations

- **Framework**: Next.js 16 (App Router) with React 19.
- **Language**: TypeScript.
- **Styling**: Tailwind CSS v4 + Framer Motion (for tactile micro-animations).
- **Backend & Database**: Firebase (Auth, Firestore) + Firebase Admin for server-side logic.
- **Mathematics**: `katex`, `react-katex`, `mathlive` for rendering and editing complex formulas.
- **Charts & UI Utilities**: `recharts` (dashboards), `lucide-react` (icons), `html2pdf.js` & `@react-pdf/renderer` (generating PDF worksheets), `react-quill-new` (rich text editing).
- **AI Integration**: Google Generative AI (`@google/generative-ai`) for image-to-test and prompt-to-test generation.
- **Internationalization (i18n)**: Custom translation dictionaries built into components supporting `uz`, `en`, and `ru`.

---

## 🗄️ 6. Database Structures (Firestore Schema)

The platform heavily utilizes Firebase Firestore (NoSQL) for real-time synchronization. The primary collections are:

1. **`users`**: The central repository for all platform accounts (Students, Teachers, Admins).
   - **Common Fields**: `uid`, `email`, `displayName`, `role` (determines access via `'student'`, `'teacher'`, or `'admin'`), `createdAt`.
   - **Student Gamification Fields**: `totalXP`, `currentStreak`, `dailyGoal`, `progress` (indexes for completed topics and chapters), `dailyHistory` (used for rendering charts), and `recentActivity` (zero-cost recent quiz fetches).
   - **Teacher Identity Fields**: `institution`, `verifiedTeacher`, `activeClassCount`, `totalStudents`, subscription details (`planId`), and AI usage constraints.
2. **`classes`**: Virtual classrooms acting as hubs for interaction between a teacher and their assigned students.
   - **Fields**: `id`, `title`, `description`, `joinCode` (auto-generated 6-character alphanumeric code for students to join), `teacherId`, `teacherName`, `studentIds` (array of enrolled students), `studentCount`, `createdAt`.
3. **`questions1` / `custom_tests` / `bsb_tests`**: Massive datasets hosting the educational material.
   - **Fields**: Path IDs (`topicId`, `chapterId`, `subtopicId`, `difficultyId`), `question` (object supporting multiple languages: uz, ru, en), `options` (A, B, C, D structure), and the correct `answer`.
4. **`attempts` / `results`**: Historical ledger of student submissions.
   - **Fields**: `studentId`, `examId`, `score`, `totalQuestions`, `timeSpent`, `submittedAt`, and deeply nested arrays of the student's chosen answers versus correct answers (used for generating review breakdowns).
5. **`requests`**: A collection dedicated to handling join requests. When a student uses a class `joinCode`, a document is created here pending teacher approval.
6. **`ieltsGroups`**: Specialized collection tailored strictly to IELTS exam prep management.

---

## 🏫 7. Class Structure & Core Functionalities

When a teacher navigates to **`app/teacher/classes/[classId]`**, they open a powerful control center for that specific cohort. A single class encompasses the following tabs and functionalities:

- **Roster (O'quvchilar)**: A comprehensive list of all enrolled `studentIds`. Teachers can view individual student profiles, monitor their progress metrics (XP, level), and remove students if necessary.
- **Requests (So'rovlar)**: An inbox for pending approvals. Students who have entered the class's `joinCode` appear here waiting for the teacher to "Accept" or "Deny" them access to the roster.
- **Exams & Assignments (Testlar/Vazifalar)**: Tests and quizzes that are explicitly bound to this class cohort. It includes tracking for open assignments, active tests, and past-due material.
- **Leaderboard (Reyting)**: A gamified, in-class ranking system based exclusively on scores and XP earned within the boundaries of assigned tasks for this specific class.
- **Materials (Materiallar)**: A repository for uploaded PDFs, study guides, external resources, and links shared directly by the teacher to the class.
- **Grading Engine (`/grade/[examId]/[studentId]`)**: A direct interface for teachers to manually review subjective answers or deeply analyze the breakdown of a student's automated test result, providing targeted feedback.

---

## 📄 8. Key Directories & Files Deep Dive

### `/data` (Static Datasets)
- **`syllabus.json`**: The core foundational "Map" of the platform. It structurally defines the hierarchy of learning: Category $\rightarrow$ Topic $\rightarrow$ Chapter $\rightarrow$ Subtopic.
- **`*/structure.json`**: Curriculum structures for specific and specialized education tracks in Uzbekistan (Maktab, Abiturient, Ixtisoslashtirilgan).
- **`library_books.json`**: A structured JSON catalog indexing textbooks and external resources available in the Student Library module.

### `/types` (TypeScript Interfaces)
- **`index.ts`**: Defines the foundational atomic models: `Topic`, `Chapter`, `Subtopic`, and standard `Question` models.
- **`user.ts`**: Highly critical file that defines `TeacherUser`, `UserProfile`, `UserLocation`, and `UserEducation`. It ensures strict type safety across the application when reading/writing from the `users` Firestore collection.
- **`ielts.ts`**: Specific typing schemas for the IELTS grading, tracking, and reading assignment module.

### `/services` (Business Logic & Firebase Queries)
- **`quizService.ts`**: Centralized logic for querying questions. It handles complex Firestore constraints (using `where`, `limit`, `startAfter` for cursor-based pagination) and powers the adaptive difficulty logic.
- **`userService.ts`**: The engine behind the gamification. Manages user profiles, guarantees username uniqueness, calculates XP increments, updates daily history, and flawlessly determines uninterrupted streaks using UTC timezone agnostic logic.
- **`historyService.ts`**: Responsible for saving attempt scorecards to the database and fetching past mistakes for the detailed step-by-step review interface.
- **`ieltsService.ts`**: Handles the distinct logic required for reading and writing IELTS band scores and manual test assignments.

### `/lib` (Core Configuration)
- **`firebase.ts`**: The bridge to Firebase. It initializes the Firebase Client SDK, wrapping Auth and Firestore for client-side operations.
- **`AuthContext.tsx`**: A React Context Provider that wraps the entire application root. It centrally distributes the `user` object, `loading` state, and handles session persistence automatically.

### `/components` (Global Reusable UI)
- **`LatexRenderer.tsx`**: A specialized wrapper component around `react-katex`. It intercepts mathematical strings and safely parses/renders complex math formulas universally across the app.
- **`NotificationBell.tsx`**: A real-time socket listener hooked into the `notifications` collection to provide instant unread alerts in the navigation bar.
- **`UserSearchModal.tsx`**: A standardized search interface enabling teachers and students to find profiles on the network dynamically.

### `/hooks` (Custom React Hooks)
- **`useAiLimits.ts`**: A safeguard hook that intercepts AI generation requests (image-to-test or prompt-to-test) and strictly validates if a teacher has sufficient monthly AI credits before proceeding.
- **`useMonthlyLimit.ts`**: The subscription enforcer. Evaluates the user's `planId` and ensures general subscription boundaries (e.g., maximum active classes a Free tier teacher is allowed to run simultaneously) are respected.




  {/* ================================================================= */}
        {/* 🟢 DYNAMIC PRICING SECTION (Sourced from plansData.ts) */}
        {/* ================================================================= */}
        <section className="py-20 lg:py-32 relative z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Header & Toggle */}
            <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-4">
                {(t as any).pricing?.badge || "TARIFLAR VA NARXLAR"}
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-8">
                {(t as any).pricing?.title || "O'zingizga mos tarifni tanlang"}
              </h2>

              {/* Dynamic Period Toggle */}
              <div className="inline-flex items-center p-1.5 bg-slate-200/60 rounded-xl md:rounded-2xl border border-slate-200/80 backdrop-blur-md shadow-inner">
                <button onClick={() => setIsSixMonth(false)} className={`px-6 py-3 rounded-lg md:rounded-xl text-[14px] font-bold transition-all ${!isSixMonth ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                  {(t as any).pricing?.monthly || "Oylik to'lov"}
                </button>
                <button onClick={() => setIsSixMonth(true)} className={`px-6 py-3 rounded-lg md:rounded-xl text-[14px] font-bold transition-all flex items-center gap-2 ${isSixMonth ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                  {(t as any).pricing?.sixMonth || "6 Oylik"}
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-md font-black ${isSixMonth ? 'bg-indigo-400/30 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    {(t as any).pricing?.discount || "Chegirma"}
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16">
              {plansArray.map((plan, index) => {
                
                // Mantiqiy hisob kitoblar (plansData'dan olinadi)
                const currentPricing = isSixMonth ? plan.pricing.sixMonth : plan.pricing.monthly;
                const finalPrice = currentPricing.price;
                const oldPrice = currentPricing.originalPrice || 0;
                const hasDiscount = oldPrice > finalPrice && !plan.pricing.isFree;
                const savings = oldPrice - finalPrice;
                const discountPercent = hasDiscount ? Math.round(((oldPrice - finalPrice) / oldPrice) * 100) : 0;
                
                const theme = getTheme(plan.id);
                const isHighlighted = plan.id === 'pro'; // Pro tarifini asosiy qilib ajratib ko'rsatamiz

                return (
                  <motion.div 
                    key={plan.id}
                    initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: index * 0.15, type: 'spring', stiffness: 100, damping: 15 }}
                    className={`relative bg-white rounded-3xl transition-all duration-500 flex flex-col overflow-hidden ${theme.highlightBorder}`}
                  >
                    {/* Gradient Header */}
                    <div className={`p-8 text-center text-white relative ${theme.gradient}`}>
                      
                      {/* Badge / Discount */}
                      {(plan.ui.badge || hasDiscount) && (
                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                          {hasDiscount ? `${discountPercent}% TEJANG` : plan.ui.badge}
                        </div>
                      )}

                      <h3 className="text-xl font-bold uppercase tracking-widest mb-4 opacity-90">{plan.ui.name}</h3>
                      
                      <div className="flex flex-col items-center justify-center min-h-[90px]">
                        {plan.pricing.isFree ? (
                          <span className="text-5xl font-black tracking-tight drop-shadow-sm">BEPUL</span>
                        ) : (
                          <>
                            {hasDiscount && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[14px] font-bold text-white/70 line-through decoration-rose-400 decoration-2">
                                  {formatNumber(oldPrice)} so'm
                                </span>
                                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                                  -{formatNumber(savings)} so'm
                                </span>
                              </div>
                            )}
                            <div className="flex items-end justify-center gap-1.5">
                              <span className="text-5xl font-black tracking-tight drop-shadow-sm leading-none">{formatNumber(finalPrice)}</span>
                            </div>
                            <span className="text-[13px] font-bold text-white/80 mt-2 block">{currentPricing.periodLabel}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* White Body (Limits & Features mapped from plansData) */}
                    <div className="p-8 flex-1 flex flex-col bg-white">
                      
                      <div className="space-y-4 mb-6 pb-6 border-b border-slate-100">
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Layout size={16}/> Sinflar</span>
                          <span className="font-black text-slate-900">{plan.displayLimits.classes}</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Users size={16}/> O'quvchilar</span>
                          <span className="font-black text-slate-900">{plan.displayLimits.students}</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2"><Bot size={16}/> AI so'rovlar</span>
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">{plan.displayLimits.aiQuestions}</span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-4 mb-8">
                        {allFeatureKeys.map((featureKey) => {
                          const isIncluded = plan.includedFeatures.includes(featureKey);
                          const featureInfo = FEATURE_REGISTRY[featureKey];

                          return (
                            <div key={featureKey} className={`flex items-start gap-3 text-[13px] font-bold group ${isIncluded ? 'text-slate-700' : 'text-slate-400 opacity-50'}`}>
                              {isIncluded ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <XCircle size={18} className="text-slate-300 shrink-0" />}
                              <span className="leading-snug flex items-center gap-1.5">
                                {featureInfo.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action Button -> Barchasi ro'yxatdan o'tishga eltadi */}
                      <Link href="/auth/signup" className="mt-auto">
                        <button className={`w-full py-4 rounded-full font-black text-[14px] uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${theme.btn}`}>
                          {plan.id === 'pro' && <Star size={18} className="fill-current" />}
                          {plan.pricing.isFree ? "Bepul Boshlash" : (plan.id === 'pro' ? "30 Kun Bepul Sinash" : "Ulanish")}
                        </button>
                      </Link>
                    </div>

                  </motion.div>
                );
              })}
            </div>

            {/* Custom B2B Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>
              <div className="absolute left-1/4 bottom-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
              
              <div className="relative z-10 text-center lg:text-left flex-1">
                <div className="inline-flex px-4 py-1.5 rounded-lg bg-white/10 text-white text-[11px] font-black uppercase tracking-widest mb-5 border border-white/10 backdrop-blur-md">
                  B2B / Ta'lim markazlari uchun
                </div>
                <h3 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Maxsus Litsenziya (Custom)</h3>
                <p className="text-slate-300 font-medium text-[14px] md:text-[16px] max-w-2xl leading-relaxed mx-auto lg:mx-0">
                  Maktablar, o'quv markazlari va ko'p sonli o'qituvchilarga ega jamoalar uchun mo'ljallangan. Cheklovsiz o'quvchilar, alohida super-admin paneli va maxsus arzonlashtirilgan narxlar kafolatlanadi.
                </p>
              </div>
              
              <div className="relative z-10 w-full lg:w-auto shrink-0">
                <a href="https://t.me/Umidjon0339" target="_blank" className="w-full lg:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 font-black text-[15px] uppercase tracking-wider rounded-full shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2.5">
                  <PhoneCall size={18} /> Admin bilan bog'lanish
                </a>
              </div>
            </motion.div>

          </div>
        </section>
        