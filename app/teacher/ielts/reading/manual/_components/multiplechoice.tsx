'use client';

import { Plus, Trash2, X } from 'lucide-react';

export default function MultipleChoiceBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  
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
    updatedQs.push({ 
      question_number: 0, 
      question_text: '', 
      options: [
        { id: 'A', text: '' }, { id: 'B', text: '' }, 
        { id: 'C', text: '' }, { id: 'D', text: '' }
      ],
      correct_answer: ['A'], 
      passage_reference: '' 
    });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const updateOption = (rIdx: number, oIdx: number, val: string) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx].options[oIdx].text = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Dynamically add an option (E, F, G...)
  const addOption = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    const opts = updatedQs[rIdx].options;
    const nextId = String.fromCharCode(65 + opts.length); // 65 is 'A'
    opts.push({ id: nextId, text: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // Delete an option and mathematically recalculate letters
  const removeOption = (rIdx: number, oIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx].options.splice(oIdx, 1);
    
    // Auto-recalculate IDs so it's always A, B, C, D
    updatedQs[rIdx].options.forEach((opt: any, i: number) => {
      opt.id = String.fromCharCode(65 + i);
    });

    // Fallback if the correct answer was the deleted option
    const currentAns = updatedQs[rIdx].correct_answer[0];
    if (!updatedQs[rIdx].options.find((o: any) => o.id === currentAns)) {
      updatedQs[rIdx].correct_answer = [updatedQs[rIdx].options[0]?.id || 'A'];
    }

    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 🌟 ULTRA-SMART PASTE ENGINE
  // ==========================================================================
  const handleSmartPaste = (e: any, rIdx: number) => {
    const pastedText = e.clipboardData.getData('Text');
    if (!pastedText.includes('\n')) return; // Normal paste
    
    e.preventDefault();
    const lines = pastedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    
    // Line 0 is the question text (strip leading numbers like "11. ")
    const qText = lines[0].replace(/^\d+[\.\)]\s*/, '');
    
    const newOptions = [];
    for (let i = 1; i < lines.length; i++) {
      // Strip leading A., B), etc. from the options
      const optText = lines[i].replace(/^[a-eA-E][\.\)]\s*/, '');
      newOptions.push({
        id: String.fromCharCode(65 + newOptions.length),
        text: optText
      });
    }

    const updatedQs = [...qb.questions];
    updatedQs[rIdx].question_text = qText;
    
    if (newOptions.length > 0) {
      updatedQs[rIdx].options = newOptions;
      // Ensure the correct answer maps to a valid option
      if (!newOptions.find(o => o.id === updatedQs[rIdx].correct_answer[0])) {
        updatedQs[rIdx].correct_answer = [newOptions[0].id];
      }
    }
    
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      
      {/* 1. HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            MULTIPLE CHOICE
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
          type="text" placeholder="Instructions (e.g. Choose the correct letter, A, B, C or D...)" 
          value={qb.instructions} onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
          className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none mb-4 p-0" 
        />
        
        {/* 2. QUESTIONS LIST */}
        <div className="space-y-4">
          {qb.questions.map((row: any, rIdx: number) => (
            <div key={rIdx} className="bg-slate-50 rounded-lg p-3 border border-slate-100 relative group/row transition-colors focus-within:border-blue-200 focus-within:bg-blue-50/20">
              
              <div className="flex gap-2 mb-3">
                <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">
                  {row.question_number}
                </span>
                <input 
                  type="text" placeholder="Question text... (Try pasting question + options here!)" 
                  value={row.question_text} 
                  onChange={e => updateRow(rIdx, 'question_text', e.target.value)} 
                  onPaste={e => handleSmartPaste(e, rIdx)}
                  className="flex-1 h-7 text-[13px] font-bold bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400 placeholder:font-normal placeholder:text-slate-400" 
                />
              </div>

              {/* DYNAMIC OPTIONS */}
              <div className="pl-10 space-y-1.5 mb-3">
                {row.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 w-4">{opt.id}.</span>
                    <input 
                      type="text" placeholder={`Option ${opt.id}...`} value={opt.text}
                      onChange={e => updateOption(rIdx, oIdx, e.target.value)}
                      className="flex-1 h-6 text-[12px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-blue-400"
                    />
                    <button 
                      onClick={() => removeOption(rIdx, oIdx)} 
                      disabled={row.options.length <= 2} // Minimum 2 options
                      className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors shrink-0"
                    >
                      <X size={14}/>
                    </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => addOption(rIdx)} 
                  className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 mt-1 ml-6"
                >
                  <Plus size={10} /> Add Option
                </button>
              </div>

              {/* 3. BOTTOM BAR (Correct Answer & Ref) */}
              <div className="pl-10 flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Correct Answer:</span>
                <select 
                  value={row.correct_answer[0] || 'A'} 
                  onChange={e => updateRow(rIdx, 'correct_answer', [e.target.value])} 
                  className="w-16 h-7 text-[11px] font-black bg-white border border-slate-200 rounded outline-none text-blue-700 focus:border-blue-400 cursor-pointer text-center"
                >
                  {row.options.map((o: any) => <option key={o.id} value={o.id}>{o.id}</option>)}
                </select>

                <input 
                  type="text" placeholder="Ref (opt)" 
                  value={row.passage_reference || ''} 
                  onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
                  className={`w-14 h-7 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors
                    ${row.passage_reference 
                      ? 'bg-blue-50 border border-blue-200 text-blue-700 focus:border-blue-400' 
                      : 'bg-transparent border border-dashed border-slate-300 text-slate-400 placeholder:text-slate-300 hover:border-slate-400 focus:border-blue-400 focus:bg-white'}`} 
                />
              </div>

              <button onClick={() => deleteRow(rIdx)} disabled={qb.questions.length === 1} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 transition-colors"><X size={14}/></button>
            </div>
          ))}
        </div>

        <button onClick={addRow} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Question
        </button>
      </div>
    </div>
  );
}