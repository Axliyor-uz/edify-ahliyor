'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, CheckCircle, Settings2, Loader2, LayoutGrid, Eye, ChevronsLeftRight, ArrowUp, ArrowDown, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { saveIeltsReadingTest } from '@/services/ieltsService';

// ============================================================================
// COMPONENT IMPORTS
// ============================================================================
import PassagePane from './_components/passsage';
import TFNGBlock from './_components/truefalseng';
import MultipleChoiceBlock from './_components/multiplechoice';
import SummaryCompletionBlock from './_components/summarycompletion';
import MatchingHeadingsBlock from './_components/matchingheadings';
import SentenceCompletionBlock from './_components/sentencecompletion';
import MatchingParagraphInfoBlock from './_components/matchingparagraphinfo';
import ShortAnswerBlock from './_components/shortanswer';
import MatchingFeaturesBlock from './_components/matchingfeatures';
import MatchingSentenceEndingsBlock from './_components/matchingsentenceendings';
import ListSelectionBlock from './_components/listselection';
import TableCompletionBlock from './_components/tablecompletion';
import FlowchartCompletionBlock from './_components/flowchartcompletion';
import DiagramCompletionBlock from './_components/diagramcompletion';
import PreviewModal from './_components/preview'; 

const T = {
  uz: {
    setup: "Yangi Test", desc: "Test parametrlarini kiriting",
    title: "Test nomi (masalan: Cambridge 18 Test 1)", time: "Vaqt (daq)", next: "Boshlash",
    save: "Saqlash", saving: "Saqlanmoqda...", addBlock: "Yangi Savol Qo'shish", preview: "Ko'zdan kechirish"
  },
  en: {
    setup: "New Test", desc: "Initialize test parameters",
    title: "Test Title (e.g. Cambridge 18 Test 1)", time: "Time (mins)", next: "Initialize",
    save: "Save", saving: "Saving...", addBlock: "Add Question Block", preview: "Preview"
  }
};

const LOCAL_STORAGE_KEY = 'ielts_reading_draft';

export default function HighDensityBuilder() {
  const router = useRouter();
  const lang = 'uz'; 
  const t = T[lang];

  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false); 
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  const [meta, setMeta] = useState({ id: '', title: '', time: 60 });
  const [passages, setPassages] = useState<any[]>([{
    id: `passage_1`, passage_number: 1, title: '', instruction: '',
    blocks: [{ type: 'text', label: 'A', content: '' }],
    questions: []
  }]);

  const [leftWidth, setLeftWidth] = useState(50);
  const isDragging = useRef(false);

  // ==========================================================================
  // DRAG TO RESIZE ENGINE
  // ==========================================================================
  const handleMouseDown = (e: React.MouseEvent) => { 
    isDragging.current = true; 
    e.preventDefault();
  };
  
  useEffect(() => {
    const handleMouseUp = () => { isDragging.current = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) setLeftWidth(newWidth);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ==========================================================================
  // AUTO-CALCULATE TOTAL QUESTIONS ACROSS ALL PASSAGES
  // ==========================================================================
  const totalQuestionsCount = passages.reduce((acc, p) => {
    return acc + p.questions.reduce((qAcc: number, qb: any) => {
      if (qb.type === 'list_selection') {
        return qAcc + qb.questions.reduce((lAcc: number, r: any) => lAcc + Math.max(1, r.correct_answer.length), 0);
      }
      return qAcc + (qb.questions ? qb.questions.length : 0);
    }, 0);
  }, 0);

  // ==========================================================================
  // CRASH-PROOF AUTO-SAVE
  // ==========================================================================
  useEffect(() => {
    const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.meta && parsed.passages) {
          setMeta(parsed.meta);
          setPassages(parsed.passages);
        }
      } catch (e) {
        console.error("Draft parsing failed", e);
      }
    }
  }, []);

  useEffect(() => {
    if (meta.title) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ meta, passages }));
    }
  }, [meta, passages]);

  // ==========================================================================
  // GLOBAL AUTO-NUMBERING ENGINE
  // ==========================================================================
  useEffect(() => {
    let globalCounter = 1;
    let needsUpdate = false;
    const newPassages = JSON.parse(JSON.stringify(passages));

    newPassages.forEach((passage: any) => {
      passage.questions.forEach((qb: any) => {
        if (qb.questions && qb.questions.length > 0) {
          const expectedStart = globalCounter;
          
          qb.questions.forEach((row: any) => {
            if (row.question_number !== globalCounter) {
              row.question_number = globalCounter;
              needsUpdate = true;
            }
            if (qb.type === 'list_selection') {
              globalCounter += Math.max(1, row.correct_answer.length);
            } else {
              globalCounter++;
            }
          });
          
          const expectedEnd = globalCounter - 1;

          if (qb.start_question !== expectedStart) {
            qb.start_question = expectedStart;
            needsUpdate = true;
          }
          if (qb.end_question !== expectedEnd) {
            qb.end_question = expectedEnd;
            needsUpdate = true;
          }
        }
      });
    });

    if (needsUpdate) setPassages(newPassages);
  }, [passages]); 

  // ==========================================================================
  // UPDATERS & STATE MANAGEMENT
  // ==========================================================================
  const updateActivePassage = (key: string, val: any) => {
    const updated = [...passages]; 
    updated[activeTab][key] = val; 
    setPassages(updated);
  };

  const updateBlock = (qbIdx: number, key: string, val: any) => {
    const q = [...passages[activeTab].questions];
    q[qbIdx][key] = val;
    updateActivePassage('questions', q);
  };

  const deleteBlock = (qbIdx: number) => {
    const q = [...passages[activeTab].questions];
    q.splice(qbIdx, 1);
    updateActivePassage('questions', q);
  };

  // 🌟 PASSAGE DELETION LOGIC
  const deletePassage = (idx: number) => {
    if (passages.length <= 1) return;
    if (!confirm("Haqiqatan ham bu matnni o'chirmoqchimisiz?")) return;
    
    const newPassages = [...passages];
    newPassages.splice(idx, 1);
    
    // Automatically renumber the remaining passages (1, 2, 3...)
    newPassages.forEach((p, i) => {
      p.passage_number = i + 1;
    });

    setPassages(newPassages);
    
    // Adjust active tab safely
    if (activeTab >= newPassages.length) {
      setActiveTab(newPassages.length - 1);
    } else if (activeTab > idx) {
      setActiveTab(activeTab - 1);
    }
  };

  const moveBlockUp = (qbIdx: number) => {
    if (qbIdx === 0) return;
    const q = [...passages[activeTab].questions];
    [q[qbIdx - 1], q[qbIdx]] = [q[qbIdx], q[qbIdx - 1]];
    updateActivePassage('questions', q);
  };

  const moveBlockDown = (qbIdx: number) => {
    const q = [...passages[activeTab].questions];
    if (qbIdx === q.length - 1) return;
    [q[qbIdx + 1], q[qbIdx]] = [q[qbIdx], q[qbIdx + 1]];
    updateActivePassage('questions', q);
  };

  const addBlock = (type: string) => {
    const q = [...passages[activeTab].questions];
    let newBlock: any = { type, start_question: 1, end_question: 1 };

    switch (type) {
      case 'true_false_not_given':
        newBlock = { ...newBlock, instructions: 'Do the following statements agree with the information given?', options: [{ label: 'TRUE', description: 'if the statement agrees' }, { label: 'FALSE', description: 'if the statement contradicts' }, { label: 'NOT GIVEN', description: 'if there is no information' }], questions: [{ question_number: 0, statement: '', correct_answer: 'TRUE', passage_reference: '' }] };
        break;
      case 'multiple_choice':
        newBlock = { ...newBlock, instructions: 'Choose the correct letter, A, B, C or D.', questions: [{ question_number: 0, question_text: '', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }, { id: 'D', text: '' }], correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'summary_completion':
        newBlock = { ...newBlock, instructions: 'Complete the summary below. Choose NO MORE THAN TWO WORDS.', summary_title: '', summary_text: '', options: null, questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_headings':
        newBlock = { ...newBlock, instructions: 'Choose the correct heading for paragraphs.', options: [{ id: 'i', text: '' }, { id: 'ii', text: '' }], questions: [{ question_number: 0, target_paragraph: '', correct_answer: '' }] };
        break;
      case 'sentence_completion':
        newBlock = { ...newBlock, instructions: 'Complete the sentences below. Choose NO MORE THAN TWO WORDS.', questions: [{ question_number: 0, sentence: '... [0] ...', correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_paragraph_information':
        newBlock = { ...newBlock, instructions: 'Which paragraph contains the following information?', options: ['A', 'B', 'C', 'D'], questions: [{ question_number: 0, statement: '', correct_answer: 'A' }] };
        break;
      case 'short_answer':
        newBlock = { ...newBlock, instructions: 'Answer the questions below. Choose NO MORE THAN TWO WORDS.', questions: [{ question_number: 0, question_text: '', correct_answer: [''], passage_reference: '' }] };
        break;
      case 'matching_features':
        newBlock = { ...newBlock, instructions: 'Classify the following statements.', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }], questions: [{ question_number: 0, statement: '', correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'matching_sentence_endings':
        newBlock = { ...newBlock, instructions: 'Complete each sentence with the correct ending.', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }], questions: [{ question_number: 0, sentence_start: '', correct_answer: ['A'], passage_reference: '' }] };
        break;
      case 'list_selection':
        newBlock = { ...newBlock, instructions: 'Choose TWO letters, A-E.', questions: [{ question_number: 0, question_text: 'Which TWO things are mentioned?', options: [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }], correct_answer: ['A', 'B'], passage_reference: '' }] };
        break;
      case 'table_completion':
        newBlock = { ...newBlock, instructions: 'Complete the table below.', table_title: '', options: null, headers: ['Header 1', 'Header 2'], rows: [{ cells: ['', ''] }], questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'flowchart_completion':
        newBlock = { ...newBlock, instructions: 'Complete the flow-chart below.', flowchart_title: '', options: null, steps: ['Step 1 with [0]'], questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
      case 'diagram_completion':
        newBlock = { ...newBlock, instructions: 'Label the diagram below.', diagram_title: '', diagram_url: '', diagram_alt_text: '', options: null, questions: [{ question_number: 0, correct_answer: [''], passage_reference: '' }] };
        break;
    }

    q.push(newBlock);
    updateActivePassage('questions', q);
    setShowAddMenu(false); 
    
    setTimeout(() => {
      const container = document.getElementById('questions-container');
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const validateTest = () => {
    if (!meta.title.trim()) { toast.error("Test nomini kiriting!"); return false; }
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      if (!p.title?.trim()) { setActiveTab(i); toast.error(`Passage ${p.passage_number}: Sarlavha kiritilmagan!`); return false; }
      for (let j = 0; j < p.questions.length; j++) {
        const qb = p.questions[j];
        if (!qb.instructions?.trim()) { setActiveTab(i); toast.error(`Passage ${p.passage_number}: Yo'riqnoma kiritilmagan!`); return false; }
        for (let k = 0; k < qb.questions.length; k++) {
          const q = qb.questions[k];
          let isAnswerMissing = false;
          if (Array.isArray(q.correct_answer)) {
            if (q.correct_answer.length === 0 || q.correct_answer.every((a: string) => !a.trim())) isAnswerMissing = true;
          } else if (!q.correct_answer || !String(q.correct_answer).trim()) {
            isAnswerMissing = true;
          }
          if (isAnswerMissing) { setActiveTab(i); toast.error(`Passage ${p.passage_number}, Savol ${q.question_number || '?'}: To'g'ri javob kiritilmagan!`); return false; }
        }
      }
    }
    return true; 
  };

  const handleSaveTest = async () => {
    if (!validateTest()) return; 
    setIsSaving(true);
    try {
      const finalPayload = {
        test_id: meta.id,
        test_title: meta.title,
        module: "reading",
        total_time_minutes: meta.time,
        total_questions: totalQuestionsCount,
        passages: passages.map((p) => {
          const wordCount = p.blocks.reduce((total: number, block: any) => total + (block.content || '').split(/\s+/).filter(Boolean).length, 0);
          const baseSlug = p.title ? p.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') : 'passage';
          return {
            id: `${baseSlug}_p${p.passage_number}`, module: "reading", passage_number: p.passage_number,
            title: p.title, subtitle: p.subtitle || "", instruction: p.instruction || "",
            word_count: wordCount, difficulty: p.difficulty || "medium",
            blocks: p.blocks, questions: p.questions
          };
        })
      };

      await saveIeltsReadingTest(finalPayload);
      localStorage.removeItem(LOCAL_STORAGE_KEY); 
      toast.success("Test muvaffaqiyatli saqlandi!");
      router.push('/teacher/ielts/reading'); 
    } catch (error) {
      toast.error("Saqlashda xatolik yuz berdi!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitialize = () => {
    if (!meta.id) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const baseSlug = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
      setMeta({ ...meta, id: `${baseSlug}_${uniqueSuffix}` });
    }
    setStep(2);
  };

  return (
    <div className="h-screen bg-[#FDFDFD] text-slate-800 font-sans selection:bg-indigo-100 overflow-hidden flex flex-col text-[13px]">
      <AnimatePresence mode="wait">
        
        {step === 1 && (
          <motion.div key="setup" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full px-3 bg-slate-50/40">
            <div className="w-full max-w-sm bg-white border border-slate-200 p-8 rounded-[2rem] shadow-sm relative">
              <Link href="/teacher/ielts/reading" className="absolute -top-10 left-0 text-slate-400 hover:text-slate-900 flex items-center gap-1.5 transition-colors font-medium">
                <ArrowLeft size={15}/> Ortga
              </Link>
              <div className="flex flex-col items-center text-center gap-3 mb-8">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]"><Settings2 size={24} strokeWidth={2.5} /></div>
                <div><h2 className="text-[18px] font-black tracking-tight text-slate-900">{t.setup}</h2><p className="text-[12px] text-slate-500 font-medium mt-0.5">{t.desc}</p></div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Test Title</label>
                  <input type="text" value={meta.title} onChange={e => setMeta({...meta, title: e.target.value})} placeholder={t.title} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl text-[14px] font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors text-slate-800 placeholder:text-slate-300 shadow-sm" autoFocus />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Time Limit</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between focus-within:border-indigo-400 focus-within:bg-white transition-colors shadow-sm">
                    <span className="text-[13px] text-slate-500 font-bold">{t.time}</span>
                    <input type="number" value={meta.time} onChange={e => setMeta({...meta, time: +e.target.value})} className="w-16 bg-transparent text-right text-[15px] font-black outline-none text-indigo-600" />
                  </div>
                </div>
                <button onClick={handleInitialize} disabled={!meta.title} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-40 mt-4 shadow-sm shadow-indigo-600/20 active:scale-[0.98]">
                  {t.next} <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
            
            {/* 🌟 REDUCED HEADER HEIGHT & PADDING */}
            <header className="flex-none h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-40 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-4">
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-slate-900 transition-colors p-1 rounded hover:bg-slate-100"><ArrowLeft size={16} /></button>
                <h1 className="font-black text-[13px] text-slate-900 max-w-[200px] md:max-w-[300px] truncate">{meta.title}</h1>
                
                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1.5 select-none transition-colors border ${totalQuestionsCount === 40 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                  <span>{meta.time}M</span><span>•</span><span>{totalQuestionsCount} / 40 Qs</span>
                </div>
              </div>
              
              <div className="flex items-center gap-5">
                
                {/* 🌟 PASSAGE TABS WITH DELETE FUNCTIONALITY */}
                <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200/60 shadow-sm gap-1">
                  {passages.map((p, idx) => (
                    <div key={p.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all group/tab relative ${activeTab === idx ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
                      <button onClick={() => setActiveTab(idx)} className="text-[11px] font-black uppercase tracking-wider">
                        Passage {p.passage_number}
                      </button>
                      
                      {passages.length > 1 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); deletePassage(idx); }} 
                          className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors 
                            ${activeTab === idx ? 'text-indigo-300 hover:bg-rose-100 hover:text-rose-600' : 'opacity-0 group-hover/tab:opacity-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600'}`}
                          title="Delete Passage"
                        >
                          <X size={10} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  ))}
                  {passages.length < 3 && (
                    <button onClick={() => setPassages([...passages, { id: `p_${Date.now()}`, passage_number: passages.length + 1, title: '', instruction: '', blocks: [{ type: 'text', label: 'A', content: '' }], questions: [] }])} className="w-6 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors ml-1"><Plus size={14}/></button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsPreviewMode(true)} className="h-7 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors active:scale-95 shadow-sm">
                    <Eye size={14} /> <span className="hidden md:inline">{t.preview}</span>
                  </button>
                  <button onClick={handleSaveTest} disabled={isSaving} className="h-7 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm shadow-indigo-600/20 active:scale-95">
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} 
                    <span className="hidden md:inline">{isSaving ? t.saving : t.save}</span>
                  </button>
                </div>
              </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
              
              <div style={{ width: `${leftWidth}%` }} className="h-full overflow-y-auto border-r border-slate-200 bg-white custom-scrollbar relative">
                <PassagePane passage={passages[activeTab]} update={updateActivePassage} />
              </div>

              <div 
                onMouseDown={handleMouseDown}
                className="w-2 bg-slate-50 border-x border-slate-200 hover:bg-slate-100 cursor-col-resize transition-colors flex-shrink-0 flex items-center justify-center z-10"
              >
                <div className="w-0.5 h-6 bg-slate-300 rounded-full"></div>
              </div>

              <div style={{ width: `${100 - leftWidth}%` }} className="h-full overflow-hidden bg-[#FAFAFA] relative flex flex-col">
                
                <div id="questions-container" className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 pb-40 space-y-6">
                  
                  {passages[activeTab].questions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 pb-20">
                       <LayoutGrid size={40} className="mb-3" strokeWidth={1.5} />
                       <p className="font-bold text-[13px] tracking-tight">No questions added yet.</p>
                    </div>
                  ) : (
                    passages[activeTab].questions.map((qb: any, qbIdx: number) => {
                      const props = { qb, qbIdx, updateBlock, deleteBlock };
                      return (
                        <div key={qbIdx} className="relative group/wrapper">
                          
                          <div className="absolute -left-10 top-2 opacity-0 group-hover/wrapper:opacity-100 flex flex-col gap-1 transition-opacity z-10">
                            <button onClick={() => moveBlockUp(qbIdx)} disabled={qbIdx === 0} className="p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-indigo-600 disabled:opacity-30"><ArrowUp size={14}/></button>
                            <button onClick={() => moveBlockDown(qbIdx)} disabled={qbIdx === passages[activeTab].questions.length - 1} className="p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-400 hover:text-indigo-600 disabled:opacity-30"><ArrowDown size={14}/></button>
                          </div>

                          {qb.type === 'true_false_not_given' && <TFNGBlock {...props} />}
                          {qb.type === 'multiple_choice' && <MultipleChoiceBlock {...props} />}
                          {qb.type === 'summary_completion' && <SummaryCompletionBlock {...props} />}
                          {qb.type === 'matching_headings' && <MatchingHeadingsBlock {...props} />}
                          {qb.type === 'sentence_completion' && <SentenceCompletionBlock {...props} />}
                          {qb.type === 'matching_paragraph_information' && <MatchingParagraphInfoBlock {...props} />}
                          {qb.type === 'short_answer' && <ShortAnswerBlock {...props} />}
                          {qb.type === 'matching_features' && <MatchingFeaturesBlock {...props} />}
                          {qb.type === 'matching_sentence_endings' && <MatchingSentenceEndingsBlock {...props} />}
                          {qb.type === 'list_selection' && <ListSelectionBlock {...props} />}
                          {qb.type === 'table_completion' && <TableCompletionBlock {...props} />}
                          {qb.type === 'flowchart_completion' && <FlowchartCompletionBlock {...props} />}
                          {qb.type === 'diagram_completion' && <DiagramCompletionBlock {...props} />}
                        </div>
                      );
                    })
                  )}

                </div>

                {/* 🌟 FIXED ADD BLOCK MENU */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
                  <div className="pointer-events-auto relative">
                    <button 
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      className="h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-[12px] flex items-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.15)] transition-all active:scale-95"
                    >
                      <Plus size={14} className={`transition-transform duration-300 ${showAddMenu ? 'rotate-45' : 'rotate-0'}`} /> {t.addBlock}
                    </button>

                    <AnimatePresence>
                      {showAddMenu && (
                        <motion.div 
                          /* 🌟 FIX: Added x: "-50%" directly to Framer Motion so it doesn't overwrite Tailwind's centering */
                          initial={{ opacity: 0, y: 15, x: "-50%", scale: 0.95 }} 
                          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }} 
                          exit={{ opacity: 0, y: 15, x: "-50%", scale: 0.95 }} 
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          style={{ transformOrigin: "bottom center" }}
                          className="absolute bottom-[130%] left-1/2 w-max max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200/80 p-3 shadow-[0_20px_50px_rgb(0,0,0,0.15)] z-50"
                        >
                          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 px-2">Select Question Type</div>
                          <div className="grid grid-cols-2 gap-1.5 w-[380px]">
                            {[
                              { type: 'matching_headings', label: 'Matching Headings' },
                              { type: 'true_false_not_given', label: 'True/False/Not Given' },
                              { type: 'multiple_choice', label: 'Multiple Choice' },
                              { type: 'summary_completion', label: 'Summary Completion' },
                              { type: 'matching_paragraph_information', label: 'Match Paragraph Info' },
                              { type: 'list_selection', label: 'List Selection' },
                              { type: 'matching_features', label: 'Matching Features' },
                              { type: 'sentence_completion', label: 'Sentence Completion' },
                              { type: 'matching_sentence_endings', label: 'Match Sentence Endings' },
                              { type: 'short_answer', label: 'Short Answer' },
                              { type: 'table_completion', label: 'Table Completion' },
                              { type: 'flowchart_completion', label: 'Flowchart Completion' },
                              { type: 'diagram_completion', label: 'Diagram Labeling' }
                            ].map((item) => (
                              <button key={item.type} onClick={() => addBlock(item.type)} className="text-left px-3 py-2 text-[11px] font-bold text-slate-700 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-100 hover:border-indigo-200 rounded-lg transition-colors truncate">
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPreviewMode && (
          <PreviewModal isOpen={isPreviewMode} onClose={() => setIsPreviewMode(false)} meta={meta} passage={passages[activeTab]} />
        )}
      </AnimatePresence>

    </div>
  );
}