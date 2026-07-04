// types/ielts.ts

import { Timestamp } from 'firebase/firestore';

export type IeltsSkill = 'listening' | 'reading' | 'writing' | 'speaking';

// ============================================================================
// PILLAR 1: THE GROUP (ielts_groups / ...)
// ============================================================================
export interface IeltsGroup {
  id?: string;
  title: string;
  targetBand: number;        // e.g. 7.0
  joinCode: string;          // MUST start with "I-" (e.g. "I-X8K2")
  teacherId: string;
  teacherName: string;
  description?: string;
  studentIds: string[];      // Array of User UIDs
  createdAt: Timestamp | Date;
}

// ============================================================================
// PILLAR 2: THE MASTER TEST BOOK (ielts_tests / ...)
// ============================================================================
export interface IeltsMasterTest {
  id?: string;
  skill: IeltsSkill;
  title: string;
  teacherId: string;
  durationMinutes: number;   // e.g. 60
  
  // Flexible payload depending on which skill this test is for
  content: {
    readingPassage?: string; 
    listeningAudioUrl?: string; 
    writingPromptTask1?: string;
    writingPromptTask2?: string;
    speakingQuestions?: string[];
  };

  // For Reading/Listening auto-checking
  answerKey?: {
    questionNumber: number;
    acceptedAnswers: string[]; // e.g. ["TRUE", "T"]
  }[];

  createdAt: Timestamp | Date;
}

// ============================================================================
// PILLAR 3: THE ASSIGNED PHOTOCOPY (/ielts_groups/{id}/assignments/...)
// ============================================================================
export interface IeltsAssignment {
  id?: string;
  testId: string;            // Refers to Pillar 2 ID
  testTitle: string;
  skill: IeltsSkill;
  assignedAt: Timestamp | Date;
  dueAt: Timestamp | Date;
  completedBy: string[];     // Array of Student UIDs who have hit 'Submit'
}

// ============================================================================
// PILLAR 4: THE FILLED-OUT EXAM PAPER (ielts_attempts / ...)
// ============================================================================
export interface IeltsAttempt {
  id?: string;
  userId: string;
  groupId: string;
  assignmentId: string;
  skill: IeltsSkill;

  studentOutput: {
    readingListeningAnswers?: Record<number, string>; // { 1: "True", 2: "Not Given" }
    writingTask1Essay?: string;
    writingTask2Essay?: string;
    speakingAudioRecordingUrl?: string;
  };

  aiGrading: {
    overallBand: number;
    criteriaBreakdown?: {
      taskAchievement?: number;
      coherence?: number;
      lexicalResource?: number;
      grammaticalRange?: number;
      pronunciation?: number;
      fluency?: number;
    };
    feedbackUz?: string;
    feedbackEn?: string;
    enhancedVersion?: string; // AI rewrites their essay to a Band 9 version
  };

  submittedAt: Timestamp | Date;
}