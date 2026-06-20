'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { BookOpen, Plus, Search, Sparkles, Database, Clock, MoreVertical, FileText, Globe, Loader2, Trash2, Copy, Send, Eye } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in duration-500 font-sans text-slate-800">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
              <BookOpen size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">IELTS Reading</h1>
          </div>
          <p className="text-[14px] font-medium text-slate-500">Matnli testlarni yarating yoki bazadan foydalaning.</p>
        </div>

        {/* CREATION BUTTON WITH DROPDOWN */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-[13px] font-bold shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
            <Plus size={18} /> Yangi Test
          </button>

          <AnimatePresence>
            {showCreateMenu && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-[0_10px_40px_rgb(0,0,0,0.08)] border border-slate-100 p-2 z-50 origin-top-right">
                <Link href="/teacher/ielts/reading/manual" className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 group transition-colors mt-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200/50"><FileText size={16} /></div>
                  <div>
                    <h4 className="text-[13px] font-bold text-slate-900 group-hover:text-slate-700">Qo'lda kiritish</h4>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Noldan o'zingiz tuzing</p>
                  </div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex p-1 bg-slate-100/60 rounded-xl w-full md:w-auto border border-slate-200/50">
          <button onClick={() => setActiveTab('myTests')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'myTests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <BookOpen size={14} /> Mening Testlarim
          </button>
          <button onClick={() => setActiveTab('database')} className={`flex-1 md:w-40 py-2 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'database' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Database size={14} /> Baza
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-[11px] text-slate-400" size={16} strokeWidth={2.5} />
          <input type="text" placeholder="Qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-[13px] font-medium shadow-sm" />
        </div>
      </div>

      {/* DATA LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
        {activeTab === 'myTests' && isLoading ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
            <Loader2 size={28} className="animate-spin text-indigo-500 mb-3" />
          </div>
        ) : filteredData.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredData.map((test) => (
              <div key={test.id} className="p-4 md:p-5 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${activeTab === 'database' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-[#FAFAFA] text-slate-600 border border-slate-200'}`}>
                    {activeTab === 'database' ? <Globe size={20} /> : <FileText size={20} />}
                  </div>
                  <div className="pt-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{test.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-sm text-[9px] font-black uppercase tracking-widest ${test.difficulty === 'easy' ? 'bg-green-100 text-green-700' : test.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{test.difficulty}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><BookOpen size={12}/> {test.wordCount} ta so'z</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Clock size={12}/> {test.qCount} savol</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto relative">
                  
                  {/* 🌟 VIEW BUTTON ROUTED TO NEW PAGE */}
                  <Link href={`/teacher/ielts/reading/view/${test.id}`} className="px-3 py-2 bg-slate-100 text-slate-700 text-[12px] font-bold rounded-lg hover:bg-slate-200 transition-colors shadow-sm flex items-center gap-1.5">
                    <Eye size={14} /> Ko'rish
                  </Link>

                  <Link href={`/teacher/ielts/reading/manual/${test.id}`} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[12px] font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                    Tahrirlash
                  </Link>

                  {/* 🌟 DELETE DROPDOWN */}
                  {activeTab === 'myTests' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setOpenDropdownId(openDropdownId === test.id ? null : test.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                        <MoreVertical size={16} />
                      </button>

                      <AnimatePresence>
                        {openDropdownId === test.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.95, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 5 }} className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.1)] border border-slate-100 py-1.5 z-50">
                            <button onClick={(e) => handleDelete(test.id, e)} className="w-full px-3 py-2 flex items-center gap-2 text-[12px] font-bold text-red-600 hover:bg-red-50 transition-colors">
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
          <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
             <Search className="text-slate-300 mb-2" size={32} />
            <h3 className="text-[15px] font-bold text-slate-900">Natija topilmadi</h3>
          </div>
        )}
      </div>
    </div>
  );
}