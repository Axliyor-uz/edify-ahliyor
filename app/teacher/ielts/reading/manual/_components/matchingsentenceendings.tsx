'use client';

import { Plus, Trash2, X, ChevronDown, ChevronUp, Edit3, Wand2 } from 'lucide-react';
import { useState } from 'react';

export default function MatchingSentenceEndingsBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const [showOptions, setShowOptions] = useState(true);

  // ==========================================================================
  // 🌟 UNIVERSAL OMNI-PASTE ENGINE
  // ==========================================================================
  const handleUniversalPaste = (e: any, fallbackContext: 'instructions' | 'options' | 'questions', targetIdx: number = 0) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; 
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const optionRegex = /^([a-zA-Z])[\.\)]\s+(.+)/;
    const questionRegex = /^(\d+)[\.\)]\s+(.+)/;

    const hasOptions = lines.some((l: string) => optionRegex.test(l));
const hasQuestions = lines.some((l: string) => questionRegex.test(l));

    if (hasOptions && hasQuestions) {
      let extractedInstructions: string[] = [];
      let extractedOptions: { id: string, text: string }[] = [];
      let extractedQuestions: any[] = [];

      lines.forEach((line: string) => {
        const optMatch = line.match(optionRegex);
        const qMatch = line.match(questionRegex);
        if (qMatch) extractedQuestions.push({ question_number: 0, sentence_start: qMatch[2], correct_answer: ['A'], passage_reference: '' });
        else if (optMatch) extractedOptions.push({ id: String.fromCharCode(65 + extractedOptions.length), text: optMatch[2] });
        else extractedInstructions.push(line);
      });

      if (extractedInstructions.length > 0) updateBlock(qbIdx, 'instructions', extractedInstructions.join(' '));
      if (extractedOptions.length > 0) updateBlock(qbIdx, 'options', extractedOptions);
      if (extractedQuestions.length > 0) {
        const defaultAns = extractedOptions.length > 0 ? extractedOptions[0].id : 'A';
        updateBlock(qbIdx, 'questions', extractedQuestions.map(q => ({ ...q, correct_answer: [defaultAns] })));
      }
      return;
    }

    if (hasOptions || fallbackContext === 'options') {
      const newOpts = [...qb.options];
      newOpts[targetIdx].text = lines[0].replace(optionRegex, '$2'); 
      for (let i = 1; i < lines.length; i++) {
        newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: lines[i].replace(optionRegex, '$2') });
      }
      updateBlock(qbIdx, 'options', newOpts);
    } 
    else if (hasQuestions || fallbackContext === 'questions') {
      const updatedQs = [...qb.questions];
      updatedQs[targetIdx].sentence_start = lines[0].replace(questionRegex, '$2');
      const defaultAns = qb.options.length > 0 ? qb.options[0].id : 'A';
      for (let i = 1; i < lines.length; i++) {
        updatedQs.splice(targetIdx + i, 0, { question_number: 0, sentence_start: lines[i].replace(questionRegex, '$2'), correct_answer: [defaultAns], passage_reference: '' });
      }
      updateBlock(qbIdx, 'questions', updatedQs);
    }
  };

  // ==========================================================================
  // ROW & OPTION HANDLERS
  // ==========================================================================
  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ question_number: 0, sentence_start: '', correct_answer: qb.options.length > 0 ? [qb.options[0].id] : ['A'], passage_reference: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addOption = () => {
    const newOpts = [...qb.options];
    newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: '' });
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

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      {/* HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            SENTENCE ENDINGS
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-slate-800 shadow-sm">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-slate-100 border border-slate-200 rounded font-bold text-slate-500">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover/block:opacity-100 transition-colors"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS */}
        <div className="relative mb-2">
          <input 
            type="text" 
            placeholder="Instructions... (Paste full block of text anywhere to auto-build!)" 
            value={qb.instructions} 
            onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
            onPaste={e => handleUniversalPaste(e, 'instructions')}
            className="w-full bg-violet-50/50 border border-dashed border-violet-200 rounded p-2 text-[11px] font-bold text-slate-700 outline-none focus:border-violet-400 focus:bg-white transition-colors pr-8" 
          />
          <Wand2 className="absolute right-2 top-2 text-violet-400" size={14} />
        </div>
        
        {/* OPTIONS EDITOR */}
        <div className="mb-4 bg-slate-50/50 p-2 rounded border border-slate-100 transition-colors hover:border-slate-200">
          <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-violet-600 uppercase tracking-wider mb-2 transition-colors">
            <Edit3 size={10} /> {showOptions ? 'Hide Endings' : 'Edit Endings'} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          
          {showOptions && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              {qb.options?.map((opt: any, oIdx: number) => (
                <div key={oIdx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[11px] font-black text-slate-400">{opt.id}.</span>
                  <input 
                    type="text" value={opt.text} placeholder="Ending text..." 
                    onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }} 
                    onPaste={e => handleUniversalPaste(e, 'options', oIdx)}
                    className="flex-1 bg-white border border-slate-200 rounded py-1.5 px-2 text-[11px] font-medium text-slate-600 outline-none focus:border-violet-400 placeholder:text-slate-300" 
                  />
                  <button onClick={() => removeOption(oIdx)} disabled={qb.options.length <= 2} className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors shrink-0"><X size={14}/></button>
                </div>
              ))}
              <button onClick={addOption} className="text-[10px] font-bold text-violet-600 hover:underline flex items-center gap-1 mt-2 ml-8">
                <Plus size={10} /> Add Ending
              </button>
            </div>
          )}
        </div>
        
        {/* SENTENCE STARTS (Questions) - UPGRADED TO TEXTAREA */}
        <div className="space-y-1">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="flex items-start gap-2 group/row transition-colors focus-within:border-violet-200 focus-within:bg-violet-50/20 p-1.5 rounded-md border border-transparent">
              
              <span className="w-8 h-7 mt-0.5 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">
                {row.question_number}
              </span>
              
              <textarea 
                placeholder="Sentence start..." 
                value={row.sentence_start} 
                onChange={e => {
                  updateRow(rIdx, 'sentence_start', e.target.value);
                  // Magic Auto-Resizer
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }} 
                onPaste={e => handleUniversalPaste(e, 'questions', rIdx)}
                onKeyDown={(e) => { 
                  // If they hit Enter (without holding Shift), it creates a new row instead of breaking the line
                  if (e.key === 'Enter' && !e.shiftKey && rIdx === qb.questions.length - 1) { 
                    e.preventDefault(); 
                    addRow(); 
                  } 
                }}
                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1.5 text-[12px] outline-none focus:border-violet-400 font-medium placeholder:font-normal placeholder:text-slate-400 resize-none overflow-hidden min-h-[32px] leading-relaxed" 
                rows={1}
              />
              
              {/* DROPDOWN */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 shrink-0 mt-0.5 h-7">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Matches:</span>
                <select 
                  value={row.correct_answer[0] || ''} 
                  onChange={e => updateRow(rIdx, 'correct_answer', [e.target.value])} 
                  className="w-12 h-6 text-[11px] font-black bg-transparent outline-none text-violet-700 cursor-pointer"
                >
                  {qb.options.length === 0 && <option value="">-</option>}
                  {qb.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>
              </div>

              {/* GHOST REFERENCE */}
              <input 
                type="text" placeholder="Ref (opt)" 
                value={row.passage_reference || ''} 
                onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                className={`w-14 h-7 mt-0.5 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors
                  ${row.passage_reference ? 'bg-violet-50 border border-violet-200 text-violet-700 focus:border-violet-400' : 'bg-transparent border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 focus:border-violet-400 focus:bg-white'}`} 
              />

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="w-6 h-7 mt-0.5 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>
        
        <button onClick={addRow} className="text-[11px] font-bold text-violet-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Sentence Start
        </button>
      </div>
    </div>
  );
}