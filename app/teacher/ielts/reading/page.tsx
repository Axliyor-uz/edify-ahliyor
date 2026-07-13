'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { BookOpen, Plus, Search, Sparkles, Database, Clock, MoreVertical, FileText, Globe, Trash2, Copy, Send, Eye, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

import { Button, IconButton, Spinner, SearchBar, EmptyState } from '@/components/ui';

const DATABASE_TESTS = [
  { id: '101', title: 'Cambridge Vol 18 - Test 1', difficulty: 'hard', wordCount: 2450, qCount: 40, date: 'System' },
];

export default function ReadingDashboard() {
  const { user } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<'myTests' | 'database'>('myTests');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [myTests, setMyTests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchMyTests = async () => {
    if (!user?.uid) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'ielts_reading_tests'), where('teacherId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => {
        const data = doc.data();
        const totalWords = data.passages?.reduce((acc: number, p: any) => acc + (p.word_count || 0), 0) || 0;
        return {
          id: doc.id,
          title: data.test_title || 'Untitled Test',
          difficulty: data.passages?.[0]?.difficulty || 'medium',
          wordCount: totalWords,
          qCount: data.total_questions || 0,
          date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'N/A',
          rawDate: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
        };
      });
      fetched.sort((a, b) => b.rawDate - a.rawDate);
      setMyTests(fetched);
    } catch (error) {
      toast.error("Testlarni yuklashda xatolik yuz berdi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchMyTests(); }, [user]);

  // 🌟 FIREBASE DELETE FUNCTION
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Haqiqatan ham bu testni butunlay o'chirib tashlamoqchimisiz?")) return;

    try {
      await deleteDoc(doc(db, 'ielts_reading_tests', id));
      setMyTests(prev => prev.filter(test => test.id !== id));
      toast.success("Test muvaffaqiyatli o'chirildi!");
    } catch (error) {
      toast.error("O'chirishda xatolik yuz berdi.");
    }
    setOpenDropdownId(null);
  };

  const filteredData = (activeTab === 'myTests' ? myTests : DATABASE_TESTS).filter(test =>
    test.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in duration-500 font-sans text-on-surface">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/teacher/ielts" className="w-8 h-8 rounded-m3-md bg-surface-container-low border border-outline-variant flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-state-hover transition-all shrink-0 mr-1 shadow-elev-1">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </Link>
            <div className="w-10 h-10 rounded-m3-md bg-primary-container text-on-primary-container flex items-center justify-center shadow-elev-1">
              <BookOpen size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-on-surface tracking-tight">IELTS Reading</h1>
          </div>
          <p className="text-[14px] font-medium text-on-surface-variant">Matnli testlarni yarating yoki bazadan foydalaning.</p>
        </div>

        {/* CREATION BUTTON WITH DROPDOWN */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <Button variant="filled" icon={<Plus />} onClick={() => setShowCreateMenu(!showCreateMenu)}>
            Yangi Test
          </Button>

          <AnimatePresence>
            {showCreateMenu && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 w-64 bg-surface-container-low rounded-m3-lg shadow-elev-3 border border-outline-variant p-2 z-50 origin-top-right">
                <Link href="/teacher/ielts/reading/manual" className="flex items-start gap-3 p-3 rounded-m3-md hover:bg-state-hover group transition-colors mt-1">
                  <div className="w-8 h-8 rounded-m3-sm bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0"><FileText size={16} /></div>
                  <div>
                    <h4 className="text-[13px] font-bold text-on-surface group-hover:text-primary">Qo'lda kiritish</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">Noldan o'zingiz tuzing</p>
                  </div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex p-1 bg-surface-container rounded-m3-md w-full md:w-auto border border-outline-variant">
          <button onClick={() => setActiveTab('myTests')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-m3-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'myTests' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <BookOpen size={14} /> Mening Testlarim
          </button>
          <button onClick={() => setActiveTab('database')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-m3-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'database' ? 'bg-surface-container-lowest text-on-surface shadow-elev-1' : 'text-on-surface-variant hover:text-on-surface'}`}>
            <Database size={14} /> Baza
          </button>
        </div>

        <SearchBar placeholder="Qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-72" />
      </div>

      {/* DATA LIST */}
      <div className="bg-surface-container-low rounded-m3-lg border border-outline-variant shadow-elev-1 overflow-hidden min-h-[300px]">
        {activeTab === 'myTests' && isLoading ? (
          <div className="flex flex-col items-center justify-center h-[300px]">
            <Spinner size={28} className="mb-3" />
          </div>
        ) : filteredData.length > 0 ? (
          <div className="divide-y divide-outline-variant">
            {filteredData.map((test) => (
              <div key={test.id} className="p-4 md:p-5 hover:bg-state-hover transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-m3-md flex items-center justify-center shrink-0 shadow-elev-1 ${activeTab === 'database' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container text-on-surface-variant border border-outline-variant'}`}>
                    {activeTab === 'database' ? <Globe size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[15px] font-bold text-on-surface group-hover:text-primary transition-colors">{test.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-m3-xs text-[9px] font-black uppercase tracking-widest ${test.difficulty === 'easy' ? 'bg-success-container text-on-success-container' : test.difficulty === 'medium' ? 'bg-warning-container text-on-warning-container' : 'bg-error-container text-on-error-container'}`}>{test.difficulty}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant"><BookOpen size={12} /> {test.wordCount} ta so'z</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant"><Clock size={12} /> {test.qCount} savol</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto relative">

                  {/* 🌟 VIEW BUTTON ROUTED TO NEW PAGE */}
                  <Link href={`/teacher/ielts/reading/view/${test.id}`} className="m3-interactive px-3 py-2 bg-secondary-container text-on-secondary-container text-[12px] font-bold rounded-m3-sm transition-colors flex items-center gap-1.5">
                    <Eye size={14} /> Ko'rish
                  </Link>

                  <Link href={`/teacher/ielts/reading/manual/${test.id}`} className="m3-interactive px-4 py-2 bg-surface-container-lowest ring-1 ring-inset ring-outline-variant text-on-surface text-[12px] font-bold rounded-m3-sm transition-colors">
                    Tahrirlash
                  </Link>

                  {/* 🌟 DELETE DROPDOWN */}
                  {activeTab === 'myTests' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <IconButton size="sm" aria-label="Qo'shimcha amallar" onClick={() => setOpenDropdownId(openDropdownId === test.id ? null : test.id)}>
                        <MoreVertical />
                      </IconButton>

                      <AnimatePresence>
                        {openDropdownId === test.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.95, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 5 }} className="absolute right-0 top-full mt-1 w-40 bg-surface-container-low rounded-m3-md shadow-elev-2 border border-outline-variant py-1.5 z-50">
                            <button onClick={(e) => handleDelete(test.id, e)} className="w-full px-3 py-2 flex items-center gap-2 text-[12px] font-bold text-error hover:bg-error-container transition-colors">
                              <Trash2 size={14} /> O'chirish
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Search />} title="Natija topilmadi" className="h-[300px] justify-center" />
        )}
      </div>
    </div>
  );
}
