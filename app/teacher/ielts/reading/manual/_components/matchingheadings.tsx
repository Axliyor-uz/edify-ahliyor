'use client';

import { Plus, Trash2, X, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { useState } from 'react';

// Helper array for auto-generating Roman Numerals
const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];

export default function MatchingHeadingsBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const [showOptions, setShowOptions] = useState(true);

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
    
    // Magic Feature: Auto-guess the next paragraph letter (A -> B -> C)
    const lastTarget = updatedQs.length > 0 ? updatedQs[updatedQs.length - 1].target_paragraph : '';
    let nextTarget = '';
    if (lastTarget && /^[A-Z]$/i.test(lastTarget)) {
      nextTarget = String.fromCharCode(lastTarget.toUpperCase().charCodeAt(0) + 1);
    } else if (updatedQs.length === 0) {
      nextTarget = 'A';
    }

    updatedQs.push({ 
      question_number: 0, 
      target_paragraph: nextTarget, 
      correct_answer: '' 
      // Removed passage_reference entirely!
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // OPTIONS (HEADINGS) HANDLERS
  // ==========================================================================
  const handlePasteOptions = (e: any, oIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (pastedText.includes('\n')) {
      e.preventDefault();
      
      // Clean up pasted lines (removes bullet points, numbers, or old roman numerals if present)
      const lines = pastedText.split('\n')
        .map((l: string) => l.replace(/^([0-9]+|[ivx]+)[\.\)]\s*/i, '').trim())
        .filter(Boolean);
      
      const newOpts = [...qb.options];
      newOpts[oIdx].text = lines[0]; // Set current row
      
      // Append the rest of the lines with auto-generated Roman Numerals
      for (let i = 1; i < lines.length; i++) {
        const nextId = ROMAN_NUMERALS[newOpts.length] || `opt${newOpts.length + 1}`;
        newOpts.push({ id: nextId, text: lines[i] });
      }
      updateBlock(qbIdx, 'options', newOpts);
    }
  };

  const addOption = () => {
    const newOpts = [...qb.options];
    const nextId = ROMAN_NUMERALS[newOpts.length] || `opt${newOpts.length + 1}`;
    newOpts.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'options', newOpts);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4">
      {/* 1. HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            MATCHING HEADINGS
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold select-none">
            Qs:
            <span className="w-8 h-5 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-slate-800 shadow-sm">{qb.start_question || 0}</span>
            -
            <span className="w-8 h-5 flex items-center justify-center bg-slate-100 border border-slate-200 rounded font-bold text-slate-500">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS */}
        <input 
          type="text" placeholder="Instructions..." value={qb.instructions} 
          onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none mb-2 p-0" 
        />
        
        {/* 2. OPTIONS EDITOR (List of Headings) */}
        <div className="mb-4 bg-slate-50/50 p-2 rounded border border-slate-100 transition-colors hover:border-slate-200">
          <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-purple-600 uppercase tracking-wider mb-1 transition-colors">
            <Edit3 size={10} /> {showOptions ? 'Hide Headings List' : 'Edit Headings List'} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showOptions && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <input 
                    type="text" value={opt.id} 
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toLowerCase(); updateBlock(qbIdx, 'options', newOpts); }}
                    className="w-10 text-[10px] font-black tracking-wider text-slate-500 bg-white border border-slate-200 px-1 py-1.5 rounded text-center outline-none focus:border-purple-400"
                  />
                  <input 
                    type="text" value={opt.text} placeholder="Paste list of headings here..." 
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }}
                    onPaste={e => handlePasteOptions(e, oIdx)}
                    className="flex-1 bg-white border border-slate-200 rounded py-1.5 px-2 text-[11px] font-medium text-slate-600 outline-none focus:border-purple-400 placeholder:text-slate-300"
                  />
                  <button onClick={() => { const newOpts = [...qb.options]; newOpts.splice(oIdx, 1); updateBlock(qbIdx, 'options', newOpts); }} className="text-slate-300 hover:text-red-500 shrink-0"><X size={14}/></button>
                </div>
              ))}
              <button onClick={addOption} className="text-[10px] font-bold text-purple-600 hover:underline flex items-center gap-1 mt-2">
                <Plus size={10} /> Add Heading
              </button>
            </div>
          )}
        </div>
        
        {/* 3. QUESTIONS GRID (Target Paragraphs) */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">{row.question_number}</span>
              
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2">
                <span className="text-[11px] font-bold text-slate-400">Paragraph</span>
                <input 
                  type="text" placeholder="A" value={row.target_paragraph} 
                  onChange={e => updateRow(rIdx, 'target_paragraph', e.target.value.toUpperCase())} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && rIdx === qb.questions.length - 1) { e.preventDefault(); addRow(); } }}
                  className="w-12 h-7 text-[12px] bg-transparent outline-none font-black text-slate-700 uppercase text-center focus:text-purple-600" 
                  maxLength={2}
                />
              </div>
              
              <select 
                value={row.correct_answer} onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)} 
                className="w-24 h-7 text-[10px] font-bold bg-white border border-slate-200 rounded px-1 outline-none text-purple-700 focus:border-purple-400 cursor-pointer shrink-0"
              >
                <option value="">Select...</option>
                {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
              </select>
              
              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0"><X size={14}/></button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1 mt-3">
          <Plus size={12} /> Add Target Paragraph
        </button>
      </div>
    </div>
  );
}