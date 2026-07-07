import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ScheduleEntry } from "@/types/attendance";

// ─── Interfaces ───────────────────────────────────────────────
export interface ClassData {
  id: string;
  title: string;
  description: string;
  joinCode: string;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  studentCount: number;
  isLocked: boolean;
  createdAt: any;
  schedule?: ScheduleEntry[];
  /** Finance: integer so'm per month; missing/0 → group is not billed. */
  monthlyFee?: number;
}

export interface CenterTeacher {
  id: string;
  centerId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  addedAt: any;
}

// ─── Chunking Utility ─────────────────────────────────────────
// Firestore `in` operator is limited to 10 items per query.
// This splits an array into chunks of the given size.
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Hook ─────────────────────────────────────────────────────
export function useCenterClasses(centerId: string | null) {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<CenterTeacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!centerId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ── Step 1: Get all teachers for this center ──
      const ctQuery = query(
        collection(db, "center_teachers"),
        where("centerId", "==", centerId)
      );
      const ctSnapshot = await getDocs(ctQuery);

      const centerTeachers: CenterTeacher[] = ctSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CenterTeacher[];

      setTeachers(centerTeachers);

      // ── Step 2: Extract teacher IDs ──
      const teacherIds = centerTeachers.map((t) => t.teacherId);

      if (teacherIds.length === 0) {
        setClasses([]);
        setIsLoading(false);
        return;
      }

      // ── Step 3: Chunk the IDs (max 10 per Firestore `in` query) ──
      const chunks = chunkArray(teacherIds, 10);

      // ── Step 4 & 5: Execute chunked queries in parallel ──
      const queryPromises = chunks.map((chunk) =>
        getDocs(
          query(
            collection(db, "classes"),
            where("teacherId", "in", chunk)
          )
        )
      );

      const snapshots = await Promise.all(queryPromises);

      // ── Step 6: Flatten, deduplicate, and sort ──
      const seenIds = new Set<string>();
      const allClasses: ClassData[] = [];

      for (const snap of snapshots) {
        for (const doc of snap.docs) {
          if (!seenIds.has(doc.id)) {
            seenIds.add(doc.id);
            allClasses.push({ id: doc.id, ...doc.data() } as ClassData);
          }
        }
      }

      // Sort by createdAt descending (newest first)
      allClasses.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setClasses(allClasses);
    } catch (err: any) {
      console.error("useCenterClasses error:", err);
      setError(err.message || "Ma'lumotlarni yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { classes, teachers, isLoading, error, refetch: fetchData };
}
