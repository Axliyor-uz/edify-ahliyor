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
