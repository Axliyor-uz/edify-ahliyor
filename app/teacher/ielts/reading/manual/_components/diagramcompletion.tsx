'use client';

import { Plus, Trash2, X, List, Type, Edit3, ChevronUp, ChevronDown, UploadCloud, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// 🌟 FIREBASE IMPORTS
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// ==========================================================================
// INDIVIDUAL ANSWER ROW
// ==========================================================================
const AnswerRow = ({ row, rIdx, updateRow, deleteRow, isWordBank, options, totalRows }: any) => {
  const [ansText, setAnsText] = useState(Array.isArray(row.correct_answer) ? row.correct_answer.join(', ') : '');

  useEffect(() => {
    setAnsText(Array.isArray(row.correct_answer) ? row.correct_answer.join(', ') : '');
  }, [row.correct_answer]);

  const handleAnsBlur = () => {
    if (isWordBank) return;
    const arr = ansText.split(',').map((s: string) => s.trim()).filter(Boolean);
    const finalArr = arr.length ? arr : [''];
    updateRow(rIdx, 'correct_answer', finalArr);
    setAnsText(finalArr.join(', '));
  };

  return (
    <div className="flex items-center gap-2 group/row transition-colors focus-within:border-fuchsia-200 focus-within:bg-fuchsia-50/20 p-1 rounded-md border border-transparent">
      <span className="w-8 h-7 flex items-center justify-center text-[11px] font-black text-white bg-slate-800 rounded shadow-sm shrink-0">
        {row.question_number}
      </span>
      
      {isWordBank ? (
        <select 
          value={row.correct_answer || ''} 
          onChange={e => updateRow(rIdx, 'correct_answer', e.target.value)} 
          className="flex-1 h-7 text-[11px] font-black bg-white border border-slate-200 rounded px-2 outline-none text-fuchsia-700 focus:border-fuchsia-400 cursor-pointer"
        >
          <option value="">Select letter...</option>
          {options.map((o: any) => <option key={o.id} value={o.id}>{o.id} - {o.text}</option>)}
        </select>
      ) : (
        <input 
          type="text" placeholder="e.g. vegetation, plants" 
          value={ansText} 
          onChange={e => setAnsText(e.target.value)} 
          onBlur={handleAnsBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAnsBlur(); }}
          className="flex-1 h-7 text-[12px] bg-white border border-slate-200 rounded px-2 outline-none focus:border-fuchsia-400 placeholder:text-slate-300 font-medium" 
        />
      )}
      
      <input 
        type="text" placeholder="Ref" value={row.passage_reference || ''} 
        onChange={e => updateRow(rIdx, 'passage_reference', e.target.value.toUpperCase())} 
        className={`w-14 h-7 text-[10px] text-center font-bold rounded outline-none uppercase shrink-0 transition-colors
          ${row.passage_reference ? 'bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 focus:border-fuchsia-400' : 'bg-transparent border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 focus:border-fuchsia-400 focus:bg-white'}`} 
      />
      
      <button onClick={() => deleteRow(rIdx)} disabled={totalRows === 1} className="w-6 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover/row:opacity-100 disabled:opacity-0 shrink-0 transition-colors"><X size={14}/></button>
    </div>
  );
};

// ==========================================================================
// MAIN COMPONENT BLOCK
// ==========================================================================
export default function DiagramCompletionBlock({ qb, qbIdx, updateBlock, deleteBlock }: any) {
  const [showOptions, setShowOptions] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isWordBank = Array.isArray(qb.options);

  const toggleMode = () => {
    if (isWordBank) {
      updateBlock(qbIdx, 'options', null);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: [''] })));
    } else {
      updateBlock(qbIdx, 'options', [{ id: 'A', text: '' }, { id: 'B', text: '' }]);
      updateBlock(qbIdx, 'questions', qb.questions.map((q: any) => ({ ...q, correct_answer: 'A' })));
    }
  };

  const updateRow = (rIdx: number, key: string, val: any) => {
    const updatedQs = [...qb.questions];
    updatedQs[rIdx][key] = val;
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const addQuestionRow = () => {
    const updatedQs = [...qb.questions];
    updatedQs.push({ question_number: 0, correct_answer: isWordBank ? (qb.options.length > 0 ? qb.options[0].id : 'A') : [''], passage_reference: '' });
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  const deleteQuestionRow = (rIdx: number) => {
    const updatedQs = [...qb.questions];
    updatedQs.splice(rIdx, 1);
    updateBlock(qbIdx, 'questions', updatedQs);
  };

  // ==========================================================================
  // 🌟 REAL FIREBASE IMAGE UPLOAD
  // ==========================================================================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // 1. Create a safe, unique filename
      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `ielts_diagrams/${timestamp}_${cleanFileName}`);

      // 2. Upload to Firebase Storage
      const snapshot = await uploadBytes(storageRef, file);
      
      // 3. Get the public URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // 4. Save the URL to your database schema
      updateBlock(qbIdx, 'diagram_url', downloadURL);

      // 5. Lazy Teacher Magic: Auto-fill diagram title if it's currently empty
      if (!qb.diagram_title) {
        const autoTitle = file.name
          .replace(/\.[^/.]+$/, "") // Remove extension
          .replace(/[-_]/g, " ")    // Replace dashes/underscores with spaces
          .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
        updateBlock(qbIdx, 'diagram_title', autoTitle);
      }

      toast.success("Rasm yuklandi!"); // Image uploaded!
    } catch (error) {
      console.error("Upload failed", error);
      toast.error("Rasmni yuklashda xatolik yuz berdi!");
    } finally {
      setIsUploading(false);
      // Reset input so they can upload the exact same file again if they deleted it
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  // ==========================================================================
  // 🌟 REAL FIREBASE IMAGE DELETE (Keeps storage clean!)
  // ==========================================================================
  const handleDeleteImage = async () => {
    if (!qb.diagram_url) return;
    
    try {
      // Create a reference directly from the download URL
      const imageRef = ref(storage, qb.diagram_url);
      await deleteObject(imageRef);
    } catch (error) {
      console.log("File already deleted or not found in storage.");
    }

    updateBlock(qbIdx, 'diagram_url', '');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm group/block mb-4 transition-all">
      {/* HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <span className="bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider">
            DIAGRAM COMPLETION
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold select-none">
            Qs: <span className="w-8 h-5 flex items-center justify-center bg-white border border-slate-200 rounded font-bold text-slate-800 shadow-sm">{qb.start_question || 0}</span>
            - <span className="w-8 h-5 flex items-center justify-center bg-slate-100 border border-slate-200 rounded font-bold text-slate-500">{qb.end_question || 0}</span>
          </div>
        </div>
        <button onClick={() => deleteBlock(qbIdx)} className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover/block:opacity-100"><Trash2 size={14}/></button>
      </div>

      <div className="p-3">
        {/* INSTRUCTIONS & TOGGLE */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <input 
            type="text" placeholder="Instructions (e.g. Label the diagram below)..." 
            value={qb.instructions} onChange={e => updateBlock(qbIdx, 'instructions', e.target.value)} 
            className="flex-1 bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none p-0 mt-1" 
          />
          <button onClick={toggleMode} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0 border ${isWordBank ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
            {isWordBank ? <><List size={12}/> Word Bank: ON</> : <><Type size={12}/> Word Bank: OFF</>}
          </button>
        </div>

        {/* OPTIONAL WORD BANK EDITOR */}
        {isWordBank && (
          <div className="mb-4 bg-fuchsia-50/30 p-2 rounded border border-fuchsia-100">
            <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-[9px] font-bold text-fuchsia-400 hover:text-fuchsia-600 uppercase tracking-wider mb-2">
              <Edit3 size={10} /> {showOptions ? 'Hide Word Bank' : 'Edit Word Bank'} {showOptions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showOptions && (
              <div className="space-y-1.5 pt-2 border-t border-fuchsia-100/50">
                {qb.options.map((opt: any, oIdx: number) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input type="text" value={opt.id} onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].id = e.target.value.toUpperCase(); updateBlock(qbIdx, 'options', newOpts); }} className="w-8 h-6 text-[10px] font-black tracking-wider text-fuchsia-600 bg-white border border-fuchsia-200 rounded text-center outline-none focus:border-fuchsia-400" maxLength={2} />
                    <input type="text" value={opt.text} placeholder="Word or phrase..." onChange={e => { const newOpts = [...qb.options]; newOpts[oIdx].text = e.target.value; updateBlock(qbIdx, 'options', newOpts); }} className="flex-1 bg-white border border-fuchsia-200 rounded py-1 px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-fuchsia-400" />
                    <button onClick={() => { const newOpts = [...qb.options]; newOpts.splice(oIdx, 1); updateBlock(qbIdx, 'options', newOpts); }} className="text-fuchsia-300 hover:text-red-500"><X size={14}/></button>
                  </div>
                ))}
                <button onClick={() => { const newOpts = [...qb.options]; newOpts.push({ id: String.fromCharCode(65 + newOpts.length), text: '' }); updateBlock(qbIdx, 'options', newOpts); }} className="text-[10px] font-bold text-fuchsia-600 hover:underline flex items-center gap-1 mt-2">
                  <Plus size={10} /> Add Word Option
                </button>
              </div>
            )}
          </div>
        )}

        {/* 🌟 IMAGE DROPZONE / PREVIEW AREA 🌟 */}
        <div className="bg-fuchsia-50/30 p-4 rounded-lg border border-fuchsia-100 mb-4 flex flex-col items-center">
          <input 
            type="text" placeholder="Diagram Title (Optional)..." 
            value={qb.diagram_title} onChange={e => updateBlock(qbIdx, 'diagram_title', e.target.value)} 
            className="w-full bg-transparent border-none text-[13px] font-black text-slate-800 outline-none mb-4 p-0 text-center placeholder:text-slate-400" 
          />
          
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

          {!qb.diagram_url ? (
            // DROPZONE UI
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm h-32 border-2 border-dashed border-fuchsia-300 bg-white rounded-xl flex flex-col items-center justify-center text-fuchsia-500 hover:bg-fuchsia-50 hover:border-fuchsia-400 transition-colors cursor-pointer"
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-fuchsia-500" size={24} />
                  <span className="text-[11px] font-bold">Yuklanmoqda...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadCloud size={28} />
                  <span className="text-[11px] font-bold">Rasmni yuklash uchun bosing</span>
                </div>
              )}
            </div>
          ) : (
            // IMAGE PREVIEW UI
            <div className="w-full flex flex-col items-center gap-3">
              <div className="relative group/img w-full max-w-sm">
                <img 
                  src={qb.diagram_url} 
                  alt="Diagram preview" 
                  className="w-full rounded-lg border border-slate-200 shadow-sm object-contain max-h-48 bg-white"
                />
                <button 
                  onClick={handleDeleteImage} 
                  className="absolute top-2 right-2 p-1.5 bg-white text-red-500 rounded shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-50"
                  title="Remove Image"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Alt Text Input */}
              <div className="w-full max-w-sm flex items-center gap-2 bg-white px-2 rounded border border-slate-200 focus-within:border-fuchsia-400">
                <ImageIcon size={14} className="text-slate-400" />
                <input 
                  type="text" placeholder="Alt Text (Impaired vision description)..." 
                  value={qb.diagram_alt_text} onChange={e => updateBlock(qbIdx, 'diagram_alt_text', e.target.value)} 
                  className="flex-1 h-7 text-[11px] bg-transparent outline-none text-slate-600 placeholder:text-slate-400" 
                />
              </div>
            </div>
          )}
        </div>
        
        {/* ANSWERS LIST */}
        <div className="space-y-1">
          <div className="flex gap-2 px-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="w-8 text-center">Q#</span>
            <span className="flex-1">{isWordBank ? 'Correct Letter' : 'Accepted Answers (Comma separated)'}</span>
            <span className="w-14 text-center">Ref</span>
            <span className="w-6"></span>
          </div>

          {qb.questions.map((row: any, rIdx: number) => (
            <AnswerRow 
              key={rIdx} row={row} rIdx={rIdx} 
              updateRow={updateRow} deleteRow={deleteQuestionRow} 
              isWordBank={isWordBank} options={qb.options} totalRows={qb.questions.length} 
            />
          ))}
        </div>
        
        <button onClick={addQuestionRow} className="text-[11px] font-bold text-fuchsia-600 hover:underline flex items-center gap-1 mt-3 transition-colors">
          <Plus size={12} /> Add Label Box
        </button>
      </div>
    </div>
  );
}