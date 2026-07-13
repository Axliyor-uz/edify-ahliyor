'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

import { Spinner } from '@/components/ui';

const LOCAL_STORAGE_KEY = 'ielts_reading_draft';

export default function EditTestSmartLoader() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    const fetchAndLoadTest = async () => {
      if (!id) return;
      
      try {
        const docRef = doc(db, 'ielts_reading_tests', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Reconstruct the data into the format the HighDensityBuilder expects
          const meta = {
            id: docSnap.id,
            title: data.test_title || 'Untitled Test',
            time: data.total_time_minutes || 60,
            totalQ: data.total_questions || 0,
          };

          // If the document has a passages array, format it
          const passages = data.passages || [{
            id: `passage_1`, passage_number: 1, title: '', instruction: '',
            blocks: [{ type: 'text', label: 'A', content: '' }],
            questions: []
          }];

          // Silently inject into local storage
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ meta, passages }));
          
          // Redirect the teacher to the manual builder. The builder will automatically 
          // trigger its "Draft restored!" useEffect and load the test perfectly.
          router.replace('/teacher/ielts/reading/manual');

        } else {
          toast.error("Test topilmadi! (Test not found)");
          router.replace('/teacher/ielts/reading');
        }
      } catch (error) {
        console.error("Error loading test:", error);
        toast.error("Xatolik yuz berdi! (Error loading test)");
        router.replace('/teacher/ielts/reading');
      }
    };

    fetchAndLoadTest();
  }, [id, router]);

  // A sleek, minimalistic loading screen while the magic happens in the background
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-surface">
      <div className="w-16 h-16 bg-surface-container-low border border-outline-variant shadow-elev-1 rounded-m3-lg flex items-center justify-center mb-6 relative">
        <BookOpen className="text-primary-container absolute" size={24} />
        <Spinner size={24} className="absolute" />
      </div>
      <h2 className="text-on-surface font-black tracking-tight text-[16px] mb-2">
        Test bazadan olinmoqda...
      </h2>
      <p className="text-on-surface-variant font-medium text-[12px] max-w-[200px] text-center leading-relaxed">
        Iltimos kuting, test ma'lumotlari tahrirlash uchun tayyorlanmoqda.
      </p>
    </div>
  );
}