'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function MatchingParagraphInfoBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  
  // 1. LOCAL STATE FIX for smooth typing
  // Change Line 9 to this:
const [optsInput, setOptsInput] = useState<string>(qb.options?.join(', ') || '');

  // Sync local state if parent changes (e.g., from database load)
  useEffect(() => {
    setOptsInput(qb.options.join(', '));
  }, [qb.options]);

  const handleOptsBlur = () => {
    const cleanArray = optsInput
      .split(',')
      .map((s: string) => s.trim().toUpperCase()) // <-- fixed here
      .filter(Boolean);
    
    updateBlock(qbIdx, 'options', cleanArray);
    setOptsInput(cleanArray.join(', ')); // Re-format the input box beautifully
  };

  // ==========================================================================
  // ROW HANDLERS
  // ==========================================================================
  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    // Default to the first available option, or 'A'
    const defaultAns = qb.options.length > 0 ? qb.options[0] : 'A';
    updatedQs.push({ question_number: 0, statement: '', correct_answer: defaultAns });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // 2. FLUID KEYBOARD ENTRY
  const handleKeyDown = (e: any, rIdx: number) => {
    if (e.key === 'Enter' && rIdx === qb.questions.length - 1) {
      e.preventDefault();
      addRow();
    }
  };

  // 3. SMART PASTE
  const handlePaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (pastedText.includes('\n')) {
      e.preventDefault();
      const lines = pastedText.split('\n').map((l: string) => l.replace(/^[0-9]+[\.\)]\s*/, '').trim()).filter(Boolean);
      
      const updatedQs = [...qb.questions];
      updatedQs[rIdx].statement = lines[0]; 
      
      const defaultAns = qb.options.length > 0 ? qb.options[0] : 'A';
      for (let i = 1; i < lines.length; i++) {
        updatedQs.splice(rIdx + i, 0, { question_number: 0, statement: lines[i], correct_answer: defaultAns });
      }
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4">
      
      {/* HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            MATCHING INFO
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
        <input 
          type="text" placeholder="Instructions..." value={qb.instructions} 
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none mb-3 p-0" 
        />
        
        {/* PARAGRAPH OPTIONS ARRAY EDITOR */}
        <div className="mb-3 flex items-center gap-2 flex-wrap bg-slate-50 p-2 rounded border border-slate-100 transition-colors focus-within:border-pink-200 focus-within:bg-pink-50/30">
          <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">Available Paragraphs:</span>
          <input 
            type="text" 
            value={optsInput} 
            onChange={e => setOptsInput(e.target.value)} // Smooth local typing
            onBlur={handleOptsBlur} // Saves to JSON when clicked away
            onKeyDown={(e) => { if (e.key === 'Enter') handleOptsBlur(); }}
            className="flex-1 bg-white border border-slate-200 rounded py-1 px-2 text-[11px] font-black text-slate-600 outline-none focus:border-pink-400 uppercase"
            placeholder="e.g. A, B, C, D, E"
          />
        </div>

        {/* QUESTIONS GRID */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">
                {row.question_number}
              </span>
              
              <input 
                type="text" placeholder="Information statement..." value={row.statement} 
                onChange={e => updateRow(rIdx, 'statement', e.target.value)} 
                onKeyDown={e => handleKeyDown(e, rIdx)}
                onPaste={e => handlePaste(e, rIdx)}
                className="flex-1 h-7 text-[12px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-pink-400 font-medium" 
              />
              
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400">Found in:</span>
                <select 
                  value={row.correct_answer} 
                  onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)} 
                  className="w-12 h-7 text-[11px] font-black bg-transparent outline-none text-pink-700 cursor-pointer"
                >
                  {qb.options.length === 0 && <option value="">-</option>}
                  {qb.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors">
                <X size={14}/>
              </button>
            </div>
          ))}
        </div>

        <button onClick={addRow} className="text-[11px] font-bold text-pink-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Statement
        </button>
      </div>
    </div>
  );
}