'use client';

import { Plus, Trash2, X, SquareSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

// ==========================================================================
// INDIVIDUAL ROW COMPONENT (Fixes the Comma Typing Issue)
// ==========================================================================
const SentenceRow = ({ row, rIdx, updateRow, deleteRow, insertBlank, totalRows }: any) => {
  // Local state allows smooth typing with commas
  const [ansText, setAnsText] = useState(row.correct_answer.join(', '));

  // Sync if parent updates
  useEffect(() => {
    setAnsText(row.correct_answer.join(', '));
  }, [row.correct_answer.join(', ')]);

  // Only format and save to JSON when the user clicks away or hits enter
  const handleAnsBlur = () => {
    const arr = ansText.split(',').map((s: string) => s.trim()).filter(Boolean);
    const finalArr = arr.length ? arr : [''];
    updateRow(rIdx, 'correct_answer', finalArr);
    setAnsText(finalArr.join(', ')); // Cleans up UI (e.g. "a , b" -> "a, b")
  };

  return (
    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 relative group/row transition-colors focus-within:border-teal-200 focus-within:bg-teal-50/20">
      <div className="flex items-start gap-2 mb-2">
        <span className="w-6 h-6 flex items-center justify-center text-[10px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0 mt-0.5">
          {row.question_number}
        </span>
        
        <textarea 
          placeholder="Type sentence... (Type [] to auto-insert blank)" 
          value={row.sentence} 
          onChange={e => { 
            updateRow(rIdx, 'sentence', e.target.value); 
            e.target.style.height = 'auto'; 
            e.target.style.height = e.target.scrollHeight + 'px'; 
          }}
          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[12px] font-medium text-slate-700 outline-none resize-none overflow-hidden min-h-[32px] focus:border-teal-400"
        />
        
        {/* CLEARER MAGIC BUTTON */}
        <button 
          onClick={() => insertBlank(rIdx)}
          className="mt-0.5 px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold text-teal-700 bg-teal-100 hover:bg-teal-200 rounded shadow-sm shrink-0 transition-colors"
          title="Add a blank bracket to this sentence"
        >
          <SquareSquare size={12} /> Add Blank
        </button>
      </div>
      
      <div className="pl-8 flex items-center gap-2">
        <input 
          type="text" placeholder="Accepted Answers (comma separated)" 
          value={ansText} 
          onChange={e => setAnsText(e.target.value)} 
          onBlur={handleAnsBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
          className="flex-1 h-7 text-[11px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-teal-400 font-bold text-teal-700" 
        />
        
        {/* GHOST REFERENCE INPUT */}
        <input 
          type="text" placeholder="Ref (opt)" 
          value={row.passage_reference || ''} 
          onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
          className={`w-14 h-7 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors
            ${row.passage_reference 
              ? 'bg-teal-50 border border-teal-200 text-teal-700 focus:border-teal-400' 
              : 'bg-transparent border border-dashed border-slate-300 text-slate-400 placeholder:text-slate-300 hover:border-slate-400 focus:border-teal-400 focus:bg-white'}`} 
        />
        
        <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
      </div>
    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT BLOCK
// ==========================================================================
export default function SentenceCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  
  // 🌟 MAGIC AUTO-HEALING REGEX ENGINE (Per Row)
  useEffect(() => {
    let needsUpdate = false;
    const updatedQs = qb.questions.map((row: any) => {
      if (!row.sentence) return row;
      
      const expectedBlank = `[${row.question_number}]`;
      const newSentence = row.sentence.replace(/\[\s*\d*\s*\]|\[_\]/g, expectedBlank);
      
      if (newSentence !== row.sentence) {
        needsUpdate = true;
        return { ...row, sentence: newSentence };
      }
      return row;
    });

    if (needsUpdate) {
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  }, [qb.questions]);

  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ 
      question_number: 0, 
      sentence: '', 
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

  // Helper to instantly insert the blank into the sentence
  const insertBlank = (rIdx: number) => {
    const row = qb.questions[rIdx];
    const expectedBlank = ` [${row.question_number}] `;
    if (!row.sentence.includes(`[${row.question_number}]`)) {
      updateRow(rIdx, 'sentence', row.sentence + expectedBlank);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            SENTENCE COMPLETION
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
          type="text" placeholder="Instructions (e.g. Choose NO MORE THAN TWO WORDS...)" 
          value={qb.instructions} 
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none mb-3 p-0" 
        />
        
        {/* 2. QUESTIONS GRID */}
        <div className="space-y-3">
          {qb.questions.map((row: any, rIdx: number) => (
            <SentenceRow 
              key={rIdx} 
              row={row} 
              rIdx={rIdx} 
              updateRow={updateRow} 
              deleteRow={deleteRow} 
              insertBlank={insertBlank} 
              totalRows={qb.questions.length} 
            />
          ))}
        </div>
        
        <button onClick={addRow} className="text-[11px] font-bold text-teal-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Sentence
        </button>
      </div>
    </div>
  );
}