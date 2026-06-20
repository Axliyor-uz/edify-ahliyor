'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Maximize, ChevronsLeftRight, Play, Pause, Highlighter } from 'lucide-react';
import toast from 'react-hot-toast';
import QuestionRenderer from './_components/question_renderer';

export default function AuthenticIELTSViewSimulator() {
  const { id } = useParams();
  const router = useRouter();
  
  const [testData, setTestData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePassageIdx, setActivePassageIdx] = useState(0);

  // 🌟 EXAM STATE
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // 🌟 HIGHLIGHTER & FONT STATE
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [baseFontSize, setBaseFontSize] = useState(14); 

  // 🌟 RESIZER STATE
  const [leftWidth, setLeftWidth] = useState(50);
  const isDragging = useRef(false);

  // ==========================================================================
  // INITIALIZATION & TIMER
  // ==========================================================================
  useEffect(() => {
    const fetchTest = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'ielts_reading_tests', id as string));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTestData(data);
          setTimeRemaining((data.total_time_minutes || 60) * 60);
        }
      } catch (error) {
        console.error("Error fetching", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => setTimeRemaining(prev => prev - 1), 1000);
    } else if (timeRemaining <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
      toast("Time's up! Your test will be submitted automatically.");
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeRemaining]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ==========================================================================
  // RESIZER & HIGHLIGHTER ENGINE
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

  useEffect(() => {
    if (!isHighlightMode) return;
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'bg-yellow-300 text-black px-0.5 rounded-sm cursor-pointer transition-colors hover:bg-red-200';
      span.title = 'Click to remove';
      span.onclick = () => {
  const parent = span.parentNode;
  if (parent) {
      parent.replaceChild(document.createTextNode(span.textContent || ''), span);
      parent.normalize();
  }
};
      try {
        range.surroundContents(span);
        selection.removeAllRanges();
      } catch (e) { /* Ignore */ }
    };
    const container = document.getElementById('passage-container');
    if (container) container.addEventListener('mouseup', handleMouseUp);
    return () => { if (container) container.removeEventListener('mouseup', handleMouseUp); };
  }, [isHighlightMode, activePassageIdx]);

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-white"><div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full"></div></div>;
  if (!testData || !testData.passages) return <div className="p-10 text-center font-bold text-gray-500">Test not found.</div>;

  const passage = testData.passages[activePassageIdx];
  const startQ = passage.questions?.[0]?.start_question || 1;
  const endQ = passage.questions?.[passage.questions.length - 1]?.end_question || 13;

  const handleAnswerChange = (qNum: number, value: any) => {
    setAnswers(prev => ({ ...prev, [qNum]: value }));
  };

  const scrollToQuestion = (qNum: number) => {
    const el = document.getElementById(`question-${qNum}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden font-sans text-gray-900 selection:bg-emerald-100">
      
      {/* 🌟 ULTRA-TIGHT HEADER WITH PASSAGE SWITCHER */}
      <header className="bg-white border-b border-gray-200 px-3 h-10 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center space-x-3 flex-1">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-800 transition-colors p-1"><ArrowLeft size={16}/></button>
          <span className="text-emerald-700 font-black text-[14px] tracking-tight hidden sm:block">IELTS</span>
          <div className="h-3 w-px bg-gray-300 hidden md:block"></div>
          <span className="text-gray-600 text-[12px] font-medium hidden lg:block truncate max-w-[150px]">{testData.test_title}</span>
        </div>

        {/* 🌟 PASSAGE SWITCHER (CENTERED) */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-sm border border-gray-200">
            {testData.passages.map((p: any, i: number) => (
              <button 
                key={i} 
                onClick={() => setActivePassageIdx(i)}
                className={`px-3 py-0.5 text-[12px] font-bold rounded-sm transition-colors ${activePassageIdx === i ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Part {p.passage_number}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-3 flex-1 justify-end">
          {/* FONT SCALER */}
          <div className="flex items-center bg-gray-100 rounded-sm p-0.5 border border-gray-200 hidden sm:flex">
             <button onClick={() => setBaseFontSize(f => Math.max(12, f - 1))} className="px-2 hover:bg-white rounded-sm text-gray-600 font-serif font-bold text-[12px]">A-</button>
             <button onClick={() => setBaseFontSize(f => Math.min(22, f + 1))} className="px-2 hover:bg-white rounded-sm text-gray-600 font-serif font-bold text-[14px]">A+</button>
          </div>

          <div className="flex items-center space-x-2 bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-200">
            <span className={`text-[13px] font-mono font-bold w-10 text-right tracking-tight ${timeRemaining < 300 ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
              {formatTime(timeRemaining)}
            </span>
            <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`p-1 rounded-sm transition-colors ${isTimerRunning ? 'text-emerald-600 hover:bg-emerald-100' : 'text-gray-400 hover:bg-gray-200'}`}>
              {isTimerRunning ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
            </button>
          </div>

          <div className="flex items-center space-x-1 hidden sm:flex">
            <button onClick={() => setIsHighlightMode(!isHighlightMode)} className={`p-1 rounded-sm transition-colors ${isHighlightMode ? 'bg-yellow-200 text-yellow-800' : 'hover:bg-gray-100 text-gray-500'}`} title="Highlight Tool"><Highlighter size={14} /></button>
            <div className="h-3 w-px bg-gray-200 mx-0.5"></div>
            <button className="p-1 hover:bg-gray-100 rounded-sm text-gray-500 transition-colors"><Maximize size={14}/></button>
          </div>
        </div>
      </header>

      {/* 🌟 SPLIT SCREEN MAIN CONTENT */}
      <div className="flex-1 flex relative h-[calc(100vh-80px)]">
        
        {/* LEFT PANEL - PASSAGE */}
        <div style={{ width: `${leftWidth}%` }} className="overflow-auto bg-white custom-scrollbar relative">
          <div className="p-4 md:p-6 lg:px-8 pb-32 max-w-4xl mx-auto" id="passage-container" style={{ fontSize: `${baseFontSize}px`, lineHeight: 1.6 }}>
            
            {passage.instruction && (
               <p className="text-left text-[0.85em] text-gray-500 italic mb-4">{passage.instruction}</p>
            )}

            <h1 className="text-center text-[1.8em] font-serif font-bold mb-2 text-gray-900 leading-tight">{passage.title}</h1>
            {passage.subtitle && <p className="text-center text-[1em] text-gray-600 font-serif italic mb-6">{passage.subtitle}</p>}

            <div className="text-justify space-y-3 text-gray-900 font-serif">
              {passage.blocks?.map((b: any, i: number) => (
                <div key={i} className="flex gap-3 items-start">
                   {b.label && <div className="font-bold text-gray-500 w-4 shrink-0 font-sans mt-[0.15em]">{b.label}</div>}
                   <div className="flex-1" dangerouslySetInnerHTML={{ __html: b.content.replace(/\n/g, '<br/>') }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 🌟 MIDDLE RESIZER */}
        <div onMouseDown={handleMouseDown} className="w-1.5 bg-gray-200 hover:bg-gray-300 cursor-col-resize transition-colors flex-shrink-0 flex items-center justify-center z-10">
           <div className="w-[1px] h-6 bg-gray-400 rounded-full"></div>
        </div>

        {/* RIGHT PANEL - QUESTIONS */}
        <div style={{ width: `${100 - leftWidth}%` }} className="overflow-auto bg-[#FCFCFC] custom-scrollbar">
          <div className="p-4 md:p-6 lg:px-8 pb-32 max-w-4xl mx-auto space-y-6" style={{ fontSize: `${baseFontSize}px`, lineHeight: 1.5 }}>
            
            {(!passage.questions || passage.questions.length === 0) ? (
               <div className="text-gray-400 italic text-center mt-10">No questions mapped.</div>
            ) : (
              passage.questions?.map((qb: any, idx: number) => (
                <QuestionRenderer 
                  key={idx} 
                  qb={qb} 
                  idx={idx} 
                  answers={answers} 
                  handleAnswerChange={handleAnswerChange} 
                />
              ))
            )}

          </div>
        </div>
      </div>

      {/* 🌟 ULTRA-SLIM EXAM FOOTER */}
      <div className="border-t border-gray-200 bg-white flex-shrink-0 z-50 sticky bottom-0">
        <div className="w-full flex items-center h-10">
          
          <div className="flex items-center space-x-1 mr-2 px-2 h-full border-r border-gray-200 bg-gray-50">
             <button onClick={() => setActivePassageIdx(Math.max(0, activePassageIdx-1))} disabled={activePassageIdx===0} className="w-6 h-6 text-emerald-700 disabled:text-gray-300 hover:bg-gray-200 rounded flex items-center justify-center transition-colors"><ChevronsLeftRight size={14}/></button>
             <button onClick={() => setActivePassageIdx(Math.min(testData.passages.length-1, activePassageIdx+1))} disabled={activePassageIdx === testData.passages.length-1} className="w-6 h-6 text-emerald-700 disabled:text-gray-300 hover:bg-gray-200 rounded flex items-center justify-center transition-colors"><ChevronsLeftRight size={14} className="rotate-180"/></button>
          </div>

          <div className="flex items-center h-full border-r border-gray-200 pr-3 mr-2">
             <span className="font-bold text-[12px] text-gray-800 uppercase tracking-widest hidden sm:block">Part {passage.passage_number}</span>
          </div>
          
          {/* Question Navigator (Only shows current passage's questions) */}
          <div className="flex flex-1 overflow-x-auto items-center px-1 gap-0.5 custom-scrollbar">
            {Array.from({ length: endQ - startQ + 1 }).map((_, i) => {
              const qNum = startQ + i;
              
              let isAnswered = false;
              let scrollToId = qNum;

              // 🌟 FIX: Find if this question belongs to a List Selection block
              const listBlock = passage.questions.find((qb: any) => 
                qb.type === 'list_selection' && qNum >= qb.start_question && qNum <= qb.end_question
              );

              if (listBlock) {
                // Get the array of answers saved under the starting question number
                const baseQNum = listBlock.questions[0]?.question_number || listBlock.start_question;
                const selectedOptions = answers[baseQNum] || [];
                
                // Calculate how many selections are needed to light up THIS specific number
                // Example: For Q18 it needs 1 answer. For Q19 it needs 2 answers.
                const requiredCount = qNum - listBlock.start_question + 1; 
                isAnswered = selectedOptions.length >= requiredCount;
                
                // Fix scrolling: Redirect clicks on Q19 to scroll to Q18's div
                scrollToId = baseQNum; 
              } else {
                // Normal questions
                const ansVal = answers[qNum];
                isAnswered = ansVal !== undefined && ansVal !== '' && (Array.isArray(ansVal) ? ansVal.length > 0 : true);
              }

              let btnClass = "relative transition-all rounded-sm text-[11px] font-bold min-w-[24px] h-[24px] flex items-center justify-center cursor-pointer ";
              
              if (isAnswered) {
                btnClass += "bg-emerald-600 text-white shadow-sm";
              } else {
                btnClass += "bg-white text-gray-800 border border-gray-300 hover:bg-gray-100";
              }

              return (
                <button key={i} onClick={() => scrollToQuestion(scrollToId)} className={btnClass}>
                  {qNum}
                </button>
              )
            })}
          </div>

          <button className="bg-emerald-700 text-white px-4 font-bold hover:bg-emerald-800 h-7 text-[12px] rounded-sm ml-2 mr-3 transition-colors">
            Submit
          </button>
        </div>
      </div>

    </div>
  );
}