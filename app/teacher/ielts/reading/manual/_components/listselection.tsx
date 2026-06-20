'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ListSelectionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  
  // List Selection usually has exactly 1 "question" object that covers multiple numbers.
  const row = qb.questions[0]; 

  // ==========================================================================
  // 1. LOCAL STATE FIX (For Smooth Comma Typing)
  // ==========================================================================
  const [ansText, setAnsText] = useState(row.correct_answer.join(', '));

  useEffect(() => {
    setAnsText(row.correct_answer.join(', '));
  }, [row.correct_answer.join(', ')]);

  const handleAnsBlur = () => {
    const arr = ansText.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
    const finalArr = arr.length ? arr : ['A']; // Fallback to avoid empty breaking
    
    const updatedQs = [...qb.questions];
    updatedQs[0].correct_answer = finalArr;
    updateBlock(qbIdx, 'questions', updatedQs);
    
    setAnsText(finalArr.join(', ')); // Clean up the UI
  };

  // ==========================================================================
  // ROW & OPTION HANDLERS
  // ==========================================================================
  const updateField = (key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[0][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const updateOption = (oIdx: number, val: string) => {
    const updatedQs = [...qb.questions];
    updatedQs[0].options[oIdx].text = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const removeOption = (oIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs[0].options.splice(oIdx, 1);
    
    // Auto-recalculate IDs so it's always A, B, C, D...
    updatedQs[0].options.forEach((opt: any, i: number) => {
      opt.id = String.fromCharCode(65 + i);
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addOption = () => {
    const updatedQs = [...qb.questions];
    const nextId = String.fromCharCode(65 + updatedQs[0].options.length);
    updatedQs[0].options.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 2. ULTRA-SMART PASTE ENGINE
  // ==========================================================================
  const handleSmartPaste = (e: any) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // Normal paste if no newlines
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    // Line 0 is the question text
    const qText = lines[0].replace(/^\d+[\.\)]\s*/, '');
    
    const newOptions = [];
    for (let i = 1; i < lines.length; i++) {
      const optText = lines[i].replace(/^[a-zA-Z][\.\)]\s*/, '');
      newOptions.push({
        id: String.fromCharCode(65 + newOptions.length),
        text: optText
      });
    }

    const updatedQs = [...qb.questions];
    updatedQs[0].question_text = qText;
    if (newOptions.length > 0) {
      updatedQs[0].options = newOptions;
    }
    
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      {/* HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            LIST SELECTION
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
        <input 
          type="text" placeholder="Instructions (e.g. Choose TWO letters, A-E)..." 
          value={qb.instructions} 
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none mb-3 p-0" 
        />
        
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative transition-colors focus-within:border-cyan-200 focus-within:bg-cyan-50/20">
          
          {/* QUESTION TEXT */}
          <div className="flex gap-2 mb-3">
            <input 
              type="text" placeholder="Question prompt... (Try pasting question + options here!)" 
              value={row.question_text} 
              onChange={e => updateField('question_text', e.target.value)} 
              onPaste={handleSmartPaste}
              className="flex-1 h-8 text-[13px] font-bold bg-white border border-slate-200 rounded px-3 outline-none focus:border-cyan-400 placeholder:font-normal placeholder:text-slate-400" 
            />
          </div>

          {/* OPTIONS MAPPING */}
          <div className="pl-2 space-y-1.5 mb-4">
            {row.options.map((opt: any, oIdx: number) => (
              <div key={opt.id} className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 w-4">{opt.id}.</span>
                <input 
                  type="text" placeholder={`Option ${opt.id}...`} 
                  value={opt.text} 
                  onChange={e => updateOption(oIdx, e.target.value)} 
                  className="flex-1 h-7 text-[12px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-cyan-400" 
                />
                <button 
                  onClick={() => removeOption(oIdx)} 
                  disabled={row.options.length <= 2}
                  className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors shrink-0"
                >
                  <X size={14}/>
                </button>
              </div>
            ))}
            <button 
              onClick={addOption} 
              className="text-[10px] font-bold text-cyan-600 hover:underline flex items-center gap-1 mt-2"
            >
              <Plus size={10} /> Add Choice
            </button>
          </div>

          {/* BOTTOM BAR (ANSWERS & REFERENCE) */}
          <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-md">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Correct Answers:</span>
            
            <input 
              type="text" placeholder="e.g. B, D" 
              value={ansText} 
              onChange={e => setAnsText(e.target.value)} 
              onBlur={handleAnsBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
              className="w-24 h-7 text-[11px] font-bold bg-transparent border-b border-slate-300 outline-none text-cyan-700 focus:border-cyan-500 text-center uppercase" 
            />
            
            <div className="flex-1 border-l border-slate-200 pl-3">
              <input 
                type="text" placeholder="Passage Ref (opt)" 
                value={row.passage_reference || ''} 
                onChange={e => updateField('passage_reference', e.target.value.toUpperCase())} 
                className={`w-full h-7 text-[10px] font-bold rounded outline-none uppercase bg-transparent transition-colors px-2
                  ${row.passage_reference 
                    ? 'text-cyan-700 bg-cyan-50 border border-cyan-200' 
                    : 'text-slate-400 placeholder:text-slate-300 hover:border-slate-400 focus:text-cyan-600'}`} 
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}