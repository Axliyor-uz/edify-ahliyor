import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; // Make sure auth is imported!

export const saveIeltsReadingTest = async (testData: any) => {
  try {
    // 1. Get the current logged-in teacher's ID
    const currentUserId = auth.currentUser?.uid;
    
    if (!currentUserId) {
      throw new Error("You must be logged in to save a test.");
    }

    const testRef = doc(db, "ielts_reading_tests", testData.test_id);
    
    await setDoc(testRef, {
      ...testData,
      teacherId: currentUserId, // 🌟 ADDED THIS: Matches the Firebase Rule!
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "published",
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error saving IELTS test:", error);
    throw new Error(error.message);
  }
};