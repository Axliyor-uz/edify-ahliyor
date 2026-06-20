'use client';

import { Plus, Trash2, X, ChevronDown, ChevronUp, Edit3, Wand2 } from 'lucide-react';
import { useState } from 'react';

export default function MatchingFeaturesBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const [showOptions, setShowOptions] = useState(true);

  // ==========================================================================
  // 🌟 OMNI-PASTE MAGIC ENGINE (Parses Full Text Chunks)
  // ==========================================================================
  const handleOmniPaste = (e: any) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // If it's just one line, paste normally
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);

    let extractedInstructions: string[] = [];
    let extractedOptions: { id: string, text: string }[] = [];
    let extractedQuestions: any[] = [];

    // Regex to detect "A. Category" or "A) Category"
    const optionRegex = /^([A-Z])[\.\)]\s+(.+)/i;
    // Regex to detect "1. Statement" or "14) Statement"
    const questionRegex = /^(\d+)[\.\)]\s+(.+)/;

    lines.forEach((line: string) => {
      const optMatch = line.match(optionRegex);
      const qMatch = line.match(questionRegex);

      if (qMatch) {
        // It's a statement!
        extractedQuestions.push({
          question_number: 0, // Global engine handles this
          statement: qMatch[2],
          correct_answer: ['A'], // Temporary fallback
          passage_reference: ''
        });
      } else if (optMatch) {
        // It's a category option!
        extractedOptions.push({
          id: String.fromCharCode(65 + extractedOptions.length), // Auto format A, B, C
          text: optMatch[2]
        });
      } else {
        // It's an instruction!
        extractedInstructions.push(line);
      }
    });

    // Update the block with whatever the engine found
    if (extractedInstructions.length > 0) {
      updateBlock(qbIdx, 'instructions', extractedInstructions.join(' '));
    }
    
    if (extractedOptions.length > 0) {
      updateBlock(qbIdx, 'options', extractedOptions);
    }
    
    if (extractedQuestions.length > 0) {
      // Safely link the correct answer default to the new options
      const defaultAns = extractedOptions.length > 0 ? extractedOptions[0].id : (qb.options.length > 0 ? qb.options[0].id : 'A');
      const mappedQs = extractedQuestions.map(q => ({ ...q, correct_answer: [defaultAns] }));
      updateBlock(qbIdx, 'questions', mappedQs);
    }
  };

  // ==========================================================================
  // ROW (STATEMENT) HANDLERS
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
      statement: '', 
      correct_answer: qb.options.length > 0 ? [qb.options[0].id] : ['A'], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Micro-Paste for Statements specifically
  const handlePasteStatements = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return;
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.replace(/^[0-9]+[\.\)]\s*/, '').trim()).filter(Boolean);
    
    const updatedQs = [...qb.questions];
    updatedQs[rIdx].statement = lines[0];
    
    const defaultAns = qb.options.length > 0 ? qb.options[0].id : 'A';
    for (let i = 1; i < lines.length; i++) {
      updatedQs.splice(rIdx + i, 0, { question_number: 0, statement: lines[i], correct_answer: [defaultAns], passage_reference: '' });
    }
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // OPTIONS (CATEGORIES) HANDLERS
  // ==========================================================================
  const addOption = () => {
    const newOpts = [...qb.options];
    const nextId = String.fromCharCode(65 + newOpts.length);
    newOpts.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'options', newOpts);
  };

  const removeOption = (oIdx: number) => {
    const newOpts = [...qb.options];
    newOpts.splice(oIdx, 1);
    
    newOpts.forEach((opt: any, i: number) => { opt.id = String.fromCharCode(65 + i); });
    updateBlock(qbIdx, 'options', newOpts);

    const updatedQs = [...qb.questions];
    updatedQs.forEach(q => {
      if (!newOpts.find((o: any) => o.id === q.correct_answer[0])) {
        q.correct_answer = newOpts.length > 0 ? [newOpts[0].id] : [''];
      }
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Micro-Paste for Categories specifically
  const handlePasteOptions = (e: any, oIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return;
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.replace(/^[a-zA-Z][\.\)]\s*/, '').trim()).filter(Boolean);
    
    const newOpts = [...qb.options];
    newOpts[oIdx].text = lines[0]; 
    
    for (let i = 1; i < lines.length; i++) {
      newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: lines[i] });
    }
    updateBlock(qbIdx, 'options', newOpts);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      {/* 1. HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            MATCHING FEATURES
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-slate-800 shadow-sm">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-slate-100 border border-slate-200 rounded font-bold text-slate-500">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover/block:opacity-100 transition-colors"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS WITH OMNI-PASTE */}
        <div className="relative mb-2">
          <input 
            type="text" 
            placeholder="Instructions... (Paste full block of text here to auto-build!)" 
            value={qb.instructions} 
            onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
            onPaste={handleOmniPaste}
            className="w-full bg-amber-50/50 border border-dashed border-amber-200 rounded p-2 text-[11px] font-bold text-slate-700 outline-none focus:border-amber-400 focus:bg-white transition-colors pr-8" 
          />
          <Wand2 className="absolute right-2 top-2 text-amber-400" size={14} />
        </div>
        
        {/* 2. CATEGORIES EDITOR (A, B, C) */}
        <div className="mb-4 bg-slate-50/50 p-2 rounded border border-slate-100 transition-colors hover:border-slate-200">
          <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-amber-600 uppercase tracking-wider mb-2 transition-colors">
            <Edit3 size={10} /> {showOptions ? 'Hide Categories (e.g. Researchers, Cities)' : 'Edit Categories (e.g. Researchers, Cities)'} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          
          {showOptions && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[11px] font-black text-slate-400">{opt.id}.</span>
                  <input 
                    type="text" value={opt.text} placeholder="Category (e.g. City authorities)..." 
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }} 
                    onPaste={e => handlePasteOptions(e, oIdx)}
                    className="flex-1 bg-white border border-slate-200 rounded py-1.5 px-2 text-[11px] font-medium text-slate-600 outline-none focus:border-amber-400 placeholder:text-slate-300" 
                  />
                  <button onClick={() => removeOption(oIdx)} disabled={qb.options.length <= 2} className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors shrink-0"><X size={14}/></button>
                </div>
              ))}
              <button onClick={addOption} className="text-[10px] font-bold text-amber-600 hover:underline flex items-center gap-1 mt-2 ml-8">
                <Plus size={10} /> Add Category
              </button>
            </div>
          )}
        </div>
        
        {/* 3. STATEMENTS TO CLASSIFY */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 group/row transition-colors focus-within:border-amber-200 focus-within:bg-amber-50/20 p-1 rounded-md border border-transparent">
              <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">
                {row.question_number}
              </span>
              
              <input 
                type="text" placeholder="Statement text... (Try pasting a list!)" 
                value={row.statement} 
                onChange={e => updateRow(rIdx, 'statement', e.target.value)} 
                onPaste={e => handlePasteStatements(e, rIdx)}
                onKeyDown={(e) => { if (e.key === 'Enter' && rIdx === qb.questions.length - 1) { e.preventDefault(); addRow(); } }}
                className="flex-1 h-7 text-[12px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-amber-400 font-medium placeholder:font-normal placeholder:text-slate-400" 
              />
              
              {/* DROPDOWN (Saves to JSON as an Array!) */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Matches:</span>
                <select 
                  value={row.correct_answer[0] || ''} 
                  onChange={e => updateRow(rIdx, 'correct_answer', [e.target.value])} 
                  className="w-12 h-7 text-[11px] font-black bg-transparent outline-none text-amber-700 cursor-pointer"
                >
                  {qb.options.length === 0 && <option value="">-</option>}
                  {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>
              </div>

              {/* GHOST REFERENCE INPUT */}
              <input 
                type="text" placeholder="Ref (opt)" 
                value={row.passage_reference || ''} 
                onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                className={`w-14 h-7 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors
                  ${row.passage_reference 
                    ? 'bg-amber-50 border border-amber-200 text-amber-700 focus:border-amber-400' 
                    : 'bg-transparent border border-dashed border-slate-300 text-slate-400 placeholder:text-slate-300 hover:border-slate-400 focus:border-amber-400 focus:bg-white'}`} 
              />

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>
        
        <button onClick={addRow} className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Statement
        </button>
      </div>
    </div>
  );
}