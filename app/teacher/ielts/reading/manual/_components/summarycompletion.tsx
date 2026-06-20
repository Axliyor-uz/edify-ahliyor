'use client';

import { Plus, Trash2, X, List, Type, Edit3, ChevronUp, ChevronDown, SquareSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function SummaryCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const [showOptions, setShowOptions] = useState(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const isWordBank = Array.isArray(qb.options);

  // ==========================================================================
  // 🌟 MAGIC AUTO-HEALING REGEX ENGINE
  // ==========================================================================
  // This ensures the numbers in the text ALWAYS match the actual question rows!
  useEffect(() => {
    if (!qb.summary_text) return;
    
    const currentNumbers = qb.questions.map((q: any) => q.question_number);
    let text = qb.summary_text;
    
    // Find all bracketed numbers like [14] OR empty brackets like [] or [_]
    const matches = text.match(/\[\s*\d*\s*\]|\[_\]/g) || [];
    let needsUpdate = false;
    
    matches.forEach((match: string, idx: number) => {
      const expectedNum = currentNumbers[idx];
      if (expectedNum && match !== `[${expectedNum}]`) {
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      let i = 0;
      // Replace all brackets with the correctly synced numbers
      const newText = text.replace(/\[\s*\d*\s*\]|\[_\]/g, () => {
         const num = currentNumbers[i++];
         return num ? `[${num}]` : `[?]`;
      });
      updateBlock(qbIdx, 'summary_text', newText);
    }
  }, [qb.questions, qb.summary_text]);


  // ==========================================================================
  // 🌟 MAGIC "INSERT BLANK" BUTTON
  // ==========================================================================
  const insertBlankAtCursor = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = qb.summary_text || '';

    // The temporary number (the engine will instantly fix this if it's wrong)
    const nextNum = (qb.start_question || 0) + qb.questions.length;
    const blankToInsert = ` [${nextNum}] `;

    // Inject the blank at the exact cursor position
    const newText = text.substring(0, start) + blankToInsert + text.substring(end);
    updateBlock(qbIdx, 'summary_text', newText);

    // Automatically add the corresponding answer row!
    addRow();

    // Refocus the textarea so the teacher can keep typing smoothly
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + blankToInsert.length, start + blankToInsert.length);
    }, 10);
  };

  // ==========================================================================
  // TOGGLE MODE (Direct Entry <--> Word Bank)
  // ==========================================================================
  const toggleMode = () => {
    if (isWordBank) {
      updateBlock(qbIdx, 'options', null);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: [''] })));
    } else {
      updateBlock(qbIdx, 'options', [{ id: 'A', text: '' }, { id: 'B', text: '' }, { id: 'C', text: '' }]);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: 'A' })));
    }
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
    updatedQs.push({ 
      question_number: 0, 
      correct_answer: isWordBank ? (qb.options.length > 0 ? qb.options[0].id : 'A') : [''], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      
      {/* 1. HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            SUMMARY COMPLETION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-slate-800 shadow-sm">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-slate-100 border border-slate-200 rounded font-bold text-slate-500">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS & MODE TOGGLE */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <input 
            type="text" placeholder="Instructions (e.g. Choose NO MORE THAN TWO WORDS...)" 
            value={qb.instructions} onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
            className="flex-1 bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none p-0 mt-1" 
          />
          <button onClick={toggleMode} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 border ${isWordBank ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
            {isWordBank ? <><List size={12}/> Word Bank: ON</> : <><Type size={12}/> Word Bank: OFF</>}
          </button>
        </div>

        {/* 2. OPTIONAL WORD BANK EDITOR */}
        {isWordBank && (
          <div className="mb-4 bg-indigo-50/30 p-2 rounded border border-indigo-100">
             {/* Word bank editor UI remains exactly the same */}
             <div className="space-y-1.5 pt-1">
                {qb.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input type="text" value={opt.id} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toUpperCase(); updateBlock(qbIdx, 'options', newOpts); }} className="w-8 h-6 text-[10px] font-black tracking-wider text-indigo-600 bg-white border border-indigo-200 rounded text-center outline-none focus:border-indigo-400" maxLength={2} />
                    <input type="text" value={opt.text} placeholder="Word or phrase..." onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }} className="flex-1 bg-white border border-indigo-200 rounded py-1 px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-400" />
                    <button onClick={() => { const newOpts = [...qb.options]; newOpts.splice(oIdx, 1); updateBlock(qbIdx, 'options', newOpts); }} className="text-indigo-300 hover:text-red-500"><X size={14}/></button>
                  </div>
                ))}
                <button onClick={() => { const newOpts = [...qb.options]; newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: '' }); updateBlock(qbIdx, 'options', newOpts); }} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-2">
                  <Plus size={10} /> Add Word Option
                </button>
              </div>
          </div>
        )}

        {/* 3. SUMMARY TEXT AREA WITH MAGIC BUTTON */}
        <div className="bg-emerald-50/30 p-3 rounded-lg border border-emerald-100 mb-4">
          <div className="flex items-center justify-between mb-2">
            <input 
              type="text" placeholder="Summary Title (Optional)..." 
              value={qb.summary_title} onChange={e => updateBlock(qbIdx, 'summary_title', e.target.value)} 
              className="flex-1 bg-transparent border-none text-[13px] font-black text-slate-800 outline-none p-0 placeholder:text-slate-400" 
            />
            {/* 🌟 THE MAGIC BUTTON 🌟 */}
            <button 
              onClick={insertBlankAtCursor} 
              className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold shadow-sm hover:bg-emerald-700 transition-colors shrink-0"
              title="Insert a blank at your cursor position"
            >
              <SquareSquare size={12} /> Insert Blank
            </button>
          </div>
          <textarea 
            ref={textAreaRef}
            placeholder="Type your summary here. Click 'Insert Blank' where an answer should go..." 
            value={qb.summary_text} 
            onChange={e => {
              updateBlock(qbIdx, 'summary_text', e.target.value);
              e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px";
            }}
            className="w-full bg-white border border-slate-200 rounded p-2 text-[13px] leading-relaxed text-slate-700 outline-none resize-none overflow-hidden min-h-[80px] focus:border-emerald-400 shadow-sm"
          />
        </div>
        
        {/* 4. INLINE DATA GRID FOR ANSWERS */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">
                {row.question_number}
              </span>
              
              {isWordBank ? (
                <select 
                  value={row.correct_answer || ''} 
                  onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)} 
                  className="flex-1 h-7 text-[11px] font-black bg-white border border-slate-200 rounded px-2 outline-none text-indigo-700 focus:border-indigo-400 cursor-pointer"
                >
                  <option value="">Select letter...</option>
                  {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id} - {o.text}</option>)}
                </select>
              ) : (
                <input 
                  type="text" placeholder="e.g. floods, flood damage" 
                  value={Array.isArray(row.correct_answer) ? row.correct_answer.join(', ') : ''} 
                  onChange={e => {
                    const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    updateRow(rIdx, 'correct_answer', arr.length ? arr : ['']);
                  }} 
                  className="flex-1 h-7 text-[12px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-emerald-400 placeholder:text-slate-300 font-medium" 
                />
              )}
              
              <input 
                type="text" placeholder="Ref" value={row.passage_reference || ''} 
                onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                className={`w-14 h-7 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors ${row.passage_reference ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 focus:border-emerald-400' : 'bg-transparent border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 focus:border-emerald-400 focus:bg-white'}`} 
              />
              
              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}