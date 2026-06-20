'use client';

import { Plus, Trash2, X, Wand2 } from 'lucide-react';
import { useState, useEffect } from 'react';

// ==========================================================================
// INDIVIDUAL ROW COMPONENT (Fixes the Comma Typing Issue)
// ==========================================================================
const QuestionRow = ({ row, rIdx, updateRow, deleteRow, totalRows, handleSmartPaste, addRow }: any) => {
  const [ansText, setAnsText] = useState(row.correct_answer.join(', '));

  useEffect(() => {
    setAnsText(row.correct_answer.join(', '));
  }, [row.correct_answer.join(', ')]);

  const handleAnsBlur = () => {
    const arr = ansText.split(',').map((s: string) => s.trim()).filter(Boolean);
    const finalArr = arr.length ? arr : [''];
    updateRow(rIdx, 'correct_answer', finalArr);
    setAnsText(finalArr.join(', ')); 
  };

  return (
    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 relative group/row transition-colors focus-within:border-orange-200 focus-within:bg-orange-50/20">
      
      <div className="flex items-start gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0 mt-0.5">
          {row.question_number}
        </span>
        
        <textarea 
          placeholder="Type the direct question... (Try pasting a numbered list here!)" 
          value={row.question_text} 
          onChange={e => { 
            updateRow(rIdx, 'question_text', e.target.value); 
            e.target.style.height = 'auto'; 
            e.target.style.height = e.target.scrollHeight + 'px'; 
          }}
          onPaste={e => handleSmartPaste(e, rIdx)}
          onKeyDown={(e) => { 
            if (e.key === 'Enter' && !e.shiftKey && rIdx === totalRows - 1) { 
              e.preventDefault(); 
              addRow(); 
            } 
          }}
          className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] font-medium text-slate-700 outline-none resize-none overflow-hidden min-h-[32px] focus:border-orange-400 leading-relaxed placeholder:font-normal placeholder:text-slate-400"
          rows={1}
        />
      </div>
      
      <div className="pl-8 flex items-center gap-2">
        <input 
          type="text" placeholder="Accepted Answers (comma separated)" 
          value={ansText} 
          onChange={e => setAnsText(e.target.value)} 
          onBlur={handleAnsBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
          className="flex-1 h-7 text-[11px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-orange-400 font-bold text-orange-700" 
        />
        
        {/* GHOST REFERENCE INPUT */}
        <input 
          type="text" placeholder="Ref (opt)" 
          value={row.passage_reference || ''} 
          onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
          className={`w-14 h-7 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors
            ${row.passage_reference 
              ? 'bg-orange-50 border border-orange-200 text-orange-700 focus:border-orange-400' 
              : 'bg-transparent border border-dashed border-slate-300 text-slate-400 placeholder:text-slate-300 hover:border-slate-400 focus:border-orange-400 focus:bg-white'}`} 
        />
        
        <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
      </div>

    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT BLOCK
// ==========================================================================
export default function ShortAnswerBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {

  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ 
      question_number: 0, 
      question_text: '', 
      correct_answer: [''], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 🌟 OMNI-PASTE ENGINE FOR QUESTIONS
  // ==========================================================================
  const handleSmartPaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // Let normal paste happen
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    const updatedQs = [...qb.questions];
    
    // Line 0 replaces current input, strip starting numbers if they exist
    updatedQs[rIdx].question_text = lines[0].replace(/^\d+[\.\)]\s*/, '');
    
    // Remaining lines spawn new inputs
    for (let i = 1; i < lines.length; i++) {
      const cleanLine = lines[i].replace(/^\d+[\.\)]\s*/, '');
      updatedQs.splice(rIdx + i, 0, { 
        question_number: 0, 
        question_text: cleanLine, 
        correct_answer: [''], 
        passage_reference: '' 
      });
    }
    
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            SHORT ANSWER
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold select-none">
            Qs: 
            <span className="w-8 h-5 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-slate-800 shadow-sm">{qb.start_question || 0}</span>
            - 
            <span className="w-8 h-5 flex items-center justify-center bg-slate-100 border border-slate-200 rounded font-bold text-slate-500">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover/block:opacity-100 transition-colors">
          <Trash2 size={14}/>
        </button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS */}
        <div className="relative mb-3">
          <input 
            type="text" placeholder="Instructions (e.g. Answer the questions below. Choose NO MORE THAN TWO WORDS...)" 
            value={qb.instructions} 
            onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
            className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none p-0 pr-6" 
          />
          <Wand2 className="absolute right-0 top-0 text-orange-300" size={14} />
        </div>
        
        {/* 2. QUESTIONS GRID */}
        <div className="space-y-3">
          {qb.questions.map((row: any, rIdx: number) => (
            <QuestionRow 
              key={rIdx} 
              row={row} 
              rIdx={rIdx} 
              updateRow={updateRow} 
              deleteRow={deleteRow} 
              totalRows={qb.questions.length}
              handleSmartPaste={handleSmartPaste}
              addRow={addRow}
            />
          ))}
        </div>
        
        <button onClick={addRow} className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Question
        </button>
      </div>
    </div>
  );
}