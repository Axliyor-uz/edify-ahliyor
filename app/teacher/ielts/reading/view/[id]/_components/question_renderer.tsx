'use client';

import { ArrowDown } from 'lucide-react';

interface QuestionRendererProps {
  qb: any;
  idx: number;
  answers: Record<number, any>;
  handleAnswerChange: (qNum: number, value: any) => void;
}

export default function QuestionRenderer({ qb, idx, answers, handleAnswerChange }: QuestionRendererProps) {
  // Only trigger the shared word bank for specific completion types,
  // NOT for matching, multiple choice, or true/false which use options differently.
  const wordBankTypes = [  'flowchart_completion'];
  const isWordBank = wordBankTypes.includes(qb.type) && Array.isArray(qb.options) && qb.options.length > 0;
  // ==========================================================================
  // SCALABLE INLINE BLANK RENDERER (Uses em units to scale with text)
  // ==========================================================================
  const renderInlineBlanks = (text: string, isWordBank: boolean = false, options: any[] = []) => {
    if (!text) return null;
    const parts = text.split(/(\[\s*\d*\s*\]|\[_\]|\[\])/g);

    return parts.map((part, i) => {
      if (/^\[.*\]$/.test(part)) {
        const numMatch = part.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0]) : 0;

        return (
          <span key={i} className="inline-flex items-center relative px-1 align-middle" id={`question-${num}`}>
            {isWordBank ? (
               <select
                 value={answers[num] || ''}
                 onChange={(e) => handleAnswerChange(num, e.target.value)}
                 className="inline-block min-w-[3.5em] h-[1.8em] border-b-[1.5px] border-outline text-center bg-transparent outline-none focus:border-primary cursor-pointer font-bold text-primary transition-colors"
               >
                 <option value="">{num}</option>
                 {options.map((opt: any, idx: number) => <option key={idx} value={opt.id}>{opt.id}</option>)}
               </select>
            ) : (
              <input
                type="text"
                placeholder={num.toString()}
                value={answers[num] || ''}
                onChange={(e) => handleAnswerChange(num, e.target.value)}
                className="inline-block min-w-[5em] w-auto h-[1.8em] border-b-[1.5px] border-outline text-center bg-transparent outline-none focus:border-primary placeholder:text-on-surface-variant font-bold text-primary transition-colors px-1"
              />
            )}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="pb-6 border-b border-outline-variant last:border-0">

      {/* MINIMAL STICKY HEADER */}
      <div className="sticky top-0 z-20 bg-[color-mix(in_oklab,var(--m3-surface)_95%,transparent)] backdrop-blur-sm py-1 mb-3">
        <h3 className="font-bold text-on-surface">Questions {qb.start_question}–{qb.end_question}</h3>
        <div className="text-[0.9em] text-on-surface-variant italic" dangerouslySetInnerHTML={{ __html: qb.instructions?.replace(/\n/g, '<br/>') }}></div>
      </div>

      {/* SHARED WORD BANK */}
      {isWordBank && (
        <div className="bg-surface-container-low p-3 mb-4 rounded-m3-sm border border-outline-variant shadow-elev-1">
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-4">
             {qb.options.map((opt:any, i:number) => (
               <div key={i} className="flex items-start text-on-surface">
                 <strong className="mr-1.5 text-primary w-3 shrink-0">{opt.id}</strong>
                 <span>{opt.text}</span>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* BLOCK TITLES */}
      {(qb.summary_title || qb.table_title || qb.flowchart_title) && (
        <h4 className="font-bold text-[1.05em] mb-3 text-center text-on-surface">{qb.summary_title || qb.table_title || qb.flowchart_title}</h4>
      )}

      {/* =================================================================== */}
      {/* 1. MATCHING HEADINGS                                                */}
      {/* =================================================================== */}
      {qb.type === 'matching_headings' && (
        <div className="space-y-6">

          {/* SAFE OPTION RENDERER: List of Headings */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-6 border border-outline rounded-m3-sm shadow-elev-1">
              <h5 className="font-bold text-[1.1em] text-on-surface mb-5 text-center tracking-wide">List of Headings</h5>
              <div className="flex flex-col space-y-3.5">
                {qb.options.map((opt: any, idx: number) => (
                  <div key={idx} className="flex items-start text-on-surface">
                    {/* Left-aligned Roman numerals with fixed width for perfect column alignment */}
                    <span className="font-bold text-primary w-[3em] shrink-0 text-left mt-[0.15em]">
                      {opt.id || '?'}
                    </span>
                    {/* Clean typographic line-height (leading-relaxed) for maximum readability */}
                    <span className="flex-1 leading-relaxed break-words">
                      {opt.text || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SAFE QUESTION RENDERER: Paragraph Matching */}
          <div className="space-y-3">
            {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => (
              // flex-wrap ensures it pushes to the next line safely on extremely small screens
              <div key={i} className="flex flex-wrap items-center gap-3" id={`question-${q?.question_number || i}`}>

                <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0">
                  {q.question_number || '?'}
                </div>

                <p className="flex-1 min-w-[120px] text-on-surface">
                  Paragraph <strong className="ml-1 text-on-surface">{q.target_paragraph || '?'}</strong>
                </p>

                <select
                  value={answers[q.question_number] || ''}
                  onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                  className="border-b-[1.5px] border-outline px-1 py-0.5 font-bold bg-transparent focus:border-primary outline-none min-w-[4.5em] shrink-0 cursor-pointer text-center text-primary transition-colors"
                >
                  <option value=""></option>
                  {Array.isArray(qb.options) && qb.options.map((o: any, idx: number) => (
                    <option key={idx} value={o.id || o}>{o.id || o}</option>
                  ))}
                </select>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* 2. TRUE / FALSE / NOT GIVEN (Also covers YES/NO/NOT GIVEN)          */}
      {/* =================================================================== */}
      {qb.type === 'true_false_not_given' && (
        <div className="space-y-6">

          {/* SAFE OPTION DEFINITIONS: Seamless text (No Card/Border) */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="flex flex-col space-y-2 mb-6 ml-1">
              {qb.options.map((opt: any, idx: number) => (
                <div key={idx} className="flex items-start text-on-surface text-[0.95em]">
                  {/* Fixed width ensures YES, NO, and NOT GIVEN align perfectly */}
                  <strong className="w-[7.5em] shrink-0 font-bold tracking-wide uppercase">
                    {opt.label || '?'}
                  </strong>
                  <span className="flex-1 leading-relaxed">
                    {opt.description || ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* SAFE QUESTION RENDERER: Statements */}
          <div className="space-y-5">
            {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => (
              <div key={i} className="flex items-start gap-3" id={`question-${q?.question_number || i}`}>

                <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0 mt-[0.15em]">
                  {q.question_number || '?'}
                </div>

                <div className="flex-1 min-w-0">
                   <p className="font-medium text-on-surface mb-2.5 leading-relaxed break-words">
                     {q.statement || ''}
                   </p>

                   {/* Horizontal Radio Buttons */}
                   <div className="flex flex-wrap gap-x-5 gap-y-2">
                     {(Array.isArray(qb.options) ? qb.options : [{label:"TRUE"},{label:"FALSE"},{label:"NOT GIVEN"}]).map((opt: any, oIdx: number) => (
                       <label key={oIdx} className="flex items-center gap-2 cursor-pointer group hover:bg-state-hover px-1.5 py-1 rounded-m3-sm transition-colors w-fit">
                         <input
                           type="radio"
                           name={`q${q.question_number}`}
                           value={opt.label}
                           checked={answers[q.question_number] === opt.label}
                           onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                           className="w-[1em] h-[1em] text-primary border-outline rounded-full cursor-pointer focus:ring-primary focus:ring-offset-0 mt-[-0.05em]"
                         />
                         <span className="text-on-surface font-medium text-[0.95em] group-hover:text-primary transition-colors uppercase">
                           {opt.label}
                         </span>
                       </label>
                     ))}
                   </div>

                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* 3. MULTIPLE CHOICE                                                  */}
      {/* =================================================================== */}
      {qb.type === 'multiple_choice' && (
        <div className="space-y-5">
          {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => {
            // Automatically detect if it's a standard "1 answer" or "Choose TWO" variation
            const isMultiSelect = Array.isArray(q.correct_answer) && q.correct_answer.length > 1;

            return (
              <div key={i} className="flex items-start gap-2.5 sm:gap-3" id={`question-${q?.question_number || i}`}>

                <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0 mt-[0.1em]">
                  {q.question_number || '?'}
                </div>

                <div className="flex-1 min-w-0">
                   {/* leading-normal tightens the spacing slightly while remaining highly readable */}
                   <p className="font-medium text-on-surface mb-2 leading-normal break-words">
                     {q.question_text || ''}
                   </p>

                   {/* Reduced vertical space between options for a more cohesive, tighter look */}
                   <div className="flex flex-col space-y-1">
                     {Array.isArray(q.options) && q.options.map((opt: any, oIdx: number) => (
                       <label key={oIdx} className="flex items-start gap-2.5 cursor-pointer group hover:bg-state-hover px-1.5 py-1 rounded-m3-sm transition-colors w-full sm:w-fit break-words">
                         <input
                           type={isMultiSelect ? "checkbox" : "radio"}
                           name={`q${q.question_number}`}
                           value={opt.id}
                           checked={isMultiSelect ? (answers[q.question_number] || []).includes(opt.id) : answers[q.question_number] === opt.id}
                           onChange={(e) => {
                              if (isMultiSelect) {
                                const curr = answers[q.question_number] || [];
                                if (e.target.checked) handleAnswerChange(q.question_number, [...curr, opt.id]);
                                else handleAnswerChange(q.question_number, curr.filter((v:string)=>v!==opt.id));
                              } else {
                                handleAnswerChange(q.question_number, e.target.value);
                              }
                           }}
                           className={`w-[1em] h-[1em] text-primary border-outline ${isMultiSelect ? 'rounded-m3-xs' : 'rounded-full'} cursor-pointer focus:ring-primary focus:ring-offset-0 mt-[0.15em] shrink-0`}
                         />
                         {/* leading-snug keeps multi-line options compact but comfortable */}
                         <span className="text-on-surface font-medium text-[0.95em] group-hover:text-primary transition-colors leading-snug">
                           <strong className="mr-2 text-on-surface">{opt.id}</strong>
                           {opt.text || ''}
                         </span>
                       </label>
                     ))}
                   </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

     {/* =================================================================== */}
      {/* 4. LIST SELECTION                                                   */}
      {/* =================================================================== */}
      {qb.type === 'list_selection' && (
        <div className="space-y-5">
          {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => {
            // Determine label: "18-19" or just "18" if start and end are identical
            const rangeLabel = qb.start_question === qb.end_question
              ? qb.start_question
              : `${qb.start_question}–${qb.end_question}`;

            return (
              <div key={i} className="flex items-start gap-2.5 sm:gap-3" id={`question-${q?.question_number || i}`}>

                <div className="px-1.5 h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0 mt-[0.1em]">
                   {rangeLabel}
                </div>

                <div className="flex-1 min-w-0">
                   <p className="font-medium text-on-surface mb-2 leading-normal break-words">
                     {q.question_text || ''}
                   </p>

                   <div className="flex flex-col space-y-1">
                     {Array.isArray(q.options) && q.options.map((opt: any, oIdx: number) => (
                       <label key={oIdx} className="flex items-start gap-2.5 cursor-pointer group hover:bg-state-hover px-1.5 py-1 rounded-m3-sm transition-colors w-full sm:w-fit break-words">
                         <input
                           type="checkbox"
                           value={opt.id}
                           checked={(answers[q.question_number] || []).includes(opt.id)}
                           onChange={(e) => {
                              const curr = answers[q.question_number] || [];
                              if (e.target.checked) handleAnswerChange(q.question_number, [...curr, opt.id]);
                              else handleAnswerChange(q.question_number, curr.filter((v:string)=>v!==opt.id));
                           }}
                           className="w-[1em] h-[1em] text-primary border-outline rounded-m3-xs cursor-pointer focus:ring-primary focus:ring-offset-0 mt-[0.15em] shrink-0"
                         />
                         <span className="text-on-surface font-medium text-[0.95em] group-hover:text-primary transition-colors leading-snug">
                           <strong className="mr-2 text-on-surface">{opt.id}</strong>
                           {opt.text || ''}
                         </span>
                       </label>
                     ))}
                   </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    {/* =================================================================== */}
      {/* 5. MATCHING PARAGRAPH INFORMATION                                   */}
      {/* =================================================================== */}
      {qb.type === 'matching_paragraph_information' && (
        <div className="space-y-4">
          {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => (
            // flex-wrap ensures it pushes the select box to the next line safely on tiny screens
            <div key={i} className="flex flex-wrap items-center gap-3" id={`question-${q?.question_number || i}`}>

              <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0">
                {q.question_number || '?'}
              </div>

              {/* min-w-[120px] and break-words prevent blowout, leading-normal enhances readability */}
              <p className="flex-1 min-w-[120px] text-on-surface font-medium leading-normal break-words">
                {q.statement || ''}
              </p>

              <select
                value={answers[q.question_number] || ''}
                onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                className="border-b-[1.5px] border-outline px-1 py-0.5 font-bold bg-transparent focus:border-primary outline-none min-w-[4.5em] shrink-0 cursor-pointer text-center text-primary transition-colors"
              >
                <option value=""></option>
                {Array.isArray(qb.options) && qb.options.map((o: any, idx: number) => (
                  // Handles both simple arrays ["A", "B"] and object arrays [{"id": "A"}]
                  <option key={idx} value={o.id || o}>{o.id || o}</option>
                ))}
              </select>

            </div>
          ))}
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. MATCHING FEATURES                                                */}
      {/* =================================================================== */}
      {qb.type === 'matching_features' && (
        <div className="space-y-6">

          {/* SAFE OPTION RENDERER: The Classification List */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-5 border border-outline rounded-m3-sm shadow-elev-1 mb-6">
              <div className="flex flex-col space-y-3">
                {qb.options.map((opt: any, idx: number) => (
                  <div key={idx} className="flex items-start text-on-surface text-[0.95em]">
                    <strong className="w-[3em] shrink-0 font-bold text-primary mt-[0.1em]">
                      {opt.id || '?'}
                    </strong>
                    <span className="flex-1 leading-relaxed">
                      {opt.text || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SAFE QUESTION RENDERER: Statements to Classify */}
          <div className="space-y-4">
            {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => (
              // flex-wrap ensures the select box safely drops to the next line on tiny screens
              <div key={i} className="flex flex-wrap items-center gap-3" id={`question-${q?.question_number || i}`}>

                <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0">
                  {q.question_number || '?'}
                </div>

                {/* min-w-[120px] and break-words prevent horizontal blowout */}
                <p className="flex-1 min-w-[120px] text-on-surface font-medium leading-normal break-words">
                  {q.statement || ''}
                </p>

                <select
                  value={answers[q.question_number] || ''}
                  onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                  className="border-b-[1.5px] border-outline px-1 py-0.5 font-bold bg-transparent focus:border-primary outline-none min-w-[4.5em] shrink-0 cursor-pointer text-center text-primary transition-colors"
                >
                  <option value=""></option>
                  {Array.isArray(qb.options) && qb.options.map((o: any, idx: number) => (
                    // In Matching Features, the answer is just the ID (e.g., A, B, C)
                    <option key={idx} value={o.id || o}>{o.id || o}</option>
                  ))}
                </select>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* 7. MATCHING SENTENCE ENDINGS                                        */}
      {/* =================================================================== */}
      {qb.type === 'matching_sentence_endings' && (
        <div className="space-y-6">

          {/* SAFE OPTION RENDERER: The Sentence Endings List */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-5 border border-outline rounded-m3-sm shadow-elev-1 mb-6">
              <div className="flex flex-col space-y-3">
                {qb.options.map((opt: any, idx: number) => (
                  <div key={idx} className="flex items-start text-on-surface text-[0.95em]">
                    {/* Fixed width for the letter IDs to create a perfect column */}
                    <strong className="w-[3em] shrink-0 font-bold text-primary mt-[0.1em]">
                      {opt.id || '?'}
                    </strong>
                    <span className="flex-1 leading-relaxed">
                      {opt.text || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SAFE QUESTION RENDERER: Incomplete Sentences */}
          <div className="space-y-4">
            {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => (
              // flex-wrap ensures the select box safely drops to the next line on tiny screens
              <div key={i} className="flex flex-wrap items-center gap-3" id={`question-${q?.question_number || i}`}>

                <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0">
                  {q.question_number || '?'}
                </div>

                {/* min-w-[120px] and break-words prevent horizontal blowout */}
                <p className="flex-1 min-w-[120px] text-on-surface font-medium leading-normal break-words">
                  {q.sentence_start || ''}
                </p>

                <select
                  value={answers[q.question_number] || ''}
                  onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                  className="border-b-[1.5px] border-outline px-1 py-0.5 font-bold bg-transparent focus:border-primary outline-none min-w-[4.5em] shrink-0 cursor-pointer text-center text-primary transition-colors"
                >
                  <option value=""></option>
                  {Array.isArray(qb.options) && qb.options.map((o: any, idx: number) => (
                    <option key={idx} value={o.id || o}>{o.id || o}</option>
                  ))}
                </select>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* 8. SUMMARY COMPLETION                                               */}
      {/* =================================================================== */}
      {qb.type === 'summary_completion' && (
        <div className="space-y-6">

          {/* INDEPENDENT WORD BANK (Only renders if this specific summary has options) */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-5 border border-outline rounded-m3-sm shadow-elev-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4">
                {qb.options.map((opt: any, i: number) => (
                  <div key={i} className="flex items-start text-on-surface text-[0.95em]">
                    <strong className="mr-2 text-primary w-[1.5em] shrink-0 text-right">{opt.id}</strong>
                    <span className="leading-snug">{opt.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUMMARY TEXT BOX */}
          <div className="bg-surface-container border border-outline-variant p-5 rounded-m3-sm shadow-elev-1">
             {qb.summary_title && (
               <h4 className="font-bold text-[1.05em] mb-4 text-center text-on-surface tracking-wide">
                 {qb.summary_title}
               </h4>
             )}

             <div className="leading-[2.4] text-on-surface font-medium text-[0.95em] md:text-[1em] text-justify">

               {/* INDEPENDENT INLINE BLANK RENDERER */}
               {qb.summary_text?.split(/(\[\s*\d*\s*\])/g).map((part: string, i: number) => {
                 if (/^\[\s*\d*\s*\]$/.test(part)) {
                   const numMatch = part.match(/\d+/);
                   const num = numMatch ? parseInt(numMatch[0]) : 0;
                   const hasWordBank = Array.isArray(qb.options) && qb.options.length > 0;

                   return (
                     <span key={i} className="inline-flex items-end relative px-1 align-baseline" id={`question-${num}`}>
                       {/* Explicitly show the question number next to the blank */}
                       <span className="text-primary font-bold text-[0.85em] mr-1.5 mb-[0.1em]">{num}.</span>

                       {hasWordBank ? (
                         <select
                           value={answers[num] || ''}
                           onChange={(e) => handleAnswerChange(num, e.target.value)}
                           /* min-w-[6em] forces the select box to look like a long ______ line */
                           className="inline-block min-w-[6em] h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary cursor-pointer font-bold text-primary transition-colors"
                         >
                           <option value=""></option>
                           {qb.options.map((opt: any, idx: number) => <option key={idx} value={opt.id}>{opt.id}</option>)}
                         </select>
                       ) : (
                         <input
                           type="text"
                           value={answers[num] || ''}
                           onChange={(e) => handleAnswerChange(num, e.target.value)}
                           /* min-w-[8em] forces the input to look like a long ______ line */
                           className="inline-block min-w-[8em] w-auto h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary placeholder:text-on-surface-variant font-bold text-primary transition-colors px-1"
                         />
                       )}
                     </span>
                   );
                 }
                 return <span key={i}>{part}</span>;
               })}

             </div>
          </div>
        </div>
      )}

            {/* =================================================================== */}
      {/* 9. SENTENCE COMPLETION                                              */}
      {/* =================================================================== */}
      {qb.type === 'sentence_completion' && (
        <div className="space-y-5">
          {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => {
            const sentence = q.sentence || '';

            return (
              <div key={i} className="flex items-start gap-3" id={`question-${q?.question_number || i}`}>

                {/* Question number badge */}
                <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0 mt-[0.15em]">
                  {q.question_number || '?'}
                </div>

                {/* Sentence with inline blank - leading-[2.6] gives room for the 1.8em tall input */}
                <div className="flex-1 min-w-0 leading-[2.6] text-on-surface font-medium text-[0.95em] md:text-[1em]">

                  {/* INDEPENDENT BLANK RENDERER */}
                  {sentence.split(/(\[\s*\d*\s*\])/g).map((part: string, idx: number) => {
                    if (/^\[\s*\d*\s*\]$/.test(part)) {
                      const numMatch = part.match(/\d+/);
                      const num = numMatch ? parseInt(numMatch[0]) : 0;

                      return (
                        <span key={idx} className="inline-flex items-end relative px-1 align-baseline">
                          <input
                            type="text"
                            value={answers[num] || ''}
                            onChange={(e) => handleAnswerChange(num, e.target.value)}
                            // min-w-[8em] creates the long ______ line
                            className="inline-block min-w-[8em] w-auto h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary placeholder:text-on-surface-variant font-bold text-primary transition-colors px-1"
                            placeholder={num.toString()}
                          />
                        </span>
                      );
                    }
                    return <span key={idx} className="break-words">{part}</span>;
                  })}

                </div>
              </div>
            );
          })}
        </div>
      )}

           {/* =================================================================== */}
      {/* 10. SHORT ANSWER                                                    */}
      {/* =================================================================== */}
      {qb.type === 'short_answer' && (
        <div className="space-y-5">
          {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => (
            <div key={i} className="flex items-start gap-3" id={`question-${q?.question_number || i}`}>

              {/* Question number badge */}
              <div className="w-[1.6em] h-[1.6em] bg-primary text-on-primary rounded-m3-xs flex items-center justify-center text-[0.8em] font-bold shrink-0 mt-[0.15em]">
                {q.question_number || '?'}
              </div>

              <div className="flex-1 min-w-0">
                {/* Question text with proper typography */}
                <p className="text-on-surface font-medium leading-normal break-words mb-2">
                  {q.question_text || ''}
                </p>

                {/* Input field with long underline */}
                <input
                  type="text"
                  value={answers[q.question_number] || ''}
                  onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                  className="w-full sm:w-[16em] border-b-[2px] border-outline font-bold text-primary bg-transparent outline-none focus:border-primary py-0.5 transition-colors text-[0.95em] placeholder:text-on-surface-variant"

                />
              </div>

            </div>
          ))}
        </div>
      )}

            {/* =================================================================== */}
      {/* 11. TABLE COMPLETION                                                */}
      {/* =================================================================== */}
      {qb.type === 'table_completion' && Array.isArray(qb.headers) && Array.isArray(qb.rows) && (
        <div className="space-y-4">

          {/* REMOVED: Table Title - now handled by shared "Block Titles" section */}

          {/* INDEPENDENT WORD BANK (Only if this table has options) */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-4 border border-outline rounded-m3-sm shadow-elev-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4">
                {qb.options.map((opt: any, i: number) => (
                  <div key={i} className="flex items-start text-on-surface text-[0.95em]">
                    <strong className="mr-2 text-primary w-[1.5em] shrink-0 text-right">{opt.id}</strong>
                    <span className="leading-snug">{opt.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto border border-outline rounded-m3-sm shadow-elev-1">
            <table className="w-full text-left border-collapse bg-surface-container-low">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline">
                  {qb.headers.map((h: string, i: number) => (
                    <th key={i} className="px-4 py-2.5 font-bold text-on-surface text-[0.85em] uppercase tracking-wide border-r border-outline last:border-0 align-middle">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qb.rows.map((rowObj: any, rIdx: number) => {
                  const cells = Array.isArray(rowObj) ? rowObj : (rowObj.cells || []);
                  const isLastRow = rIdx === qb.rows.length - 1;

                  return (
                    <tr key={rIdx} className={`${!isLastRow ? 'border-b border-outline-variant' : ''} hover:bg-state-hover transition-colors`}>
                      {cells.map((cell: string, cIdx: number) => (
                        <td key={cIdx} className="px-4 py-3 text-on-surface align-top border-r border-outline-variant last:border-0 leading-[2.6]">
                          {/* INDEPENDENT INLINE BLANK RENDERER */}
                          {cell.split(/(\[\s*\d*\s*\])/g).map((part: string, idx: number) => {
                            if (/^\[\s*\d*\s*\]$/.test(part)) {
                              const numMatch = part.match(/\d+/);
                              const num = numMatch ? parseInt(numMatch[0]) : 0;
                              const hasWordBank = Array.isArray(qb.options) && qb.options.length > 0;

                              return (
                                <span key={idx} className="inline-flex items-end relative px-1 align-baseline">
                                  {hasWordBank ? (
                                    <select
                                      value={answers[num] || ''}
                                      onChange={(e) => handleAnswerChange(num, e.target.value)}
                                      className="inline-block min-w-[5em] h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary cursor-pointer font-bold text-primary transition-colors"
                                    >
                                      <option value=""></option>
                                      {qb.options.map((opt: any, optIdx: number) => (
                                        <option key={optIdx} value={opt.id}>{opt.id}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={answers[num] || ''}
                                      onChange={(e) => handleAnswerChange(num, e.target.value)}
                                      className="inline-block min-w-[7em] w-auto h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary placeholder:text-on-surface-variant font-bold text-primary transition-colors px-1"
                                      placeholder={num.toString()}
                                    />
                                  )}
                                </span>
                              );
                            }
                            return <span key={idx} className="break-words">{part}</span>;
                          })}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 12. FLOWCHART COMPLETION                                            */}
      {/* =================================================================== */}
      {qb.type === 'flowchart_completion' && Array.isArray(qb.steps) && (
        <div className="space-y-4">

          {/* REMOVED: Flowchart Title - now handled by shared "Block Titles" section */}

          {/* INDEPENDENT WORD BANK (Only if this flowchart has options) */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-4 border border-outline rounded-m3-sm shadow-elev-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4">
                {qb.options.map((opt: any, i: number) => (
                  <div key={i} className="flex items-start text-on-surface text-[0.95em]">
                    <strong className="mr-2 text-primary w-[1.5em] shrink-0 text-right">{opt.id}</strong>
                    <span className="leading-snug">{opt.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flowchart Steps */}
          <div className="flex flex-col items-center py-6 px-4 bg-surface-container border border-outline-variant rounded-m3-sm shadow-elev-1">
            {qb.steps.map((step: string, sIdx: number) => {
              const hasWordBank = Array.isArray(qb.options) && qb.options.length > 0;

              return (
                <div key={sIdx} className="flex flex-col items-center w-full max-w-lg">

                  {/* Arrow between steps */}
                  {sIdx > 0 && (
                    <div className="flex flex-col items-center my-2">
                      <div className="w-px h-5 bg-outline"></div>
                      <ArrowDown size={16} className="text-on-surface-variant -mt-[0.1em]" strokeWidth={2} />
                    </div>
                  )}

                  {/* Step Box */}
                  <div className="w-full border border-outline p-4 rounded-m3-sm bg-surface-container-lowest shadow-elev-1">
                    <div className="text-center leading-[2.6] text-on-surface font-medium text-[0.95em] md:text-[1em]">

                      {/* INDEPENDENT INLINE BLANK RENDERER */}
                      {step.split(/(\[\s*\d*\s*\])/g).map((part: string, idx: number) => {
                        if (/^\[\s*\d*\s*\]$/.test(part)) {
                          const numMatch = part.match(/\d+/);
                          const num = numMatch ? parseInt(numMatch[0]) : 0;

                          return (
                            <span key={idx} className="inline-flex items-end relative px-1 align-baseline">
                              {hasWordBank ? (
                                <select
                                  value={answers[num] || ''}
                                  onChange={(e) => handleAnswerChange(num, e.target.value)}
                                  className="inline-block min-w-[5em] h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary cursor-pointer font-bold text-primary transition-colors"
                                >
                                  <option value=""></option>
                                  {qb.options.map((opt: any, optIdx: number) => (
                                    <option key={optIdx} value={opt.id}>{opt.id}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={answers[num] || ''}
                                  onChange={(e) => handleAnswerChange(num, e.target.value)}
                                  className="inline-block min-w-[7em] w-auto h-[1.8em] border-b-[2px] border-outline text-center bg-transparent outline-none focus:border-primary placeholder:text-on-surface-variant font-bold text-primary transition-colors px-1"
                                  placeholder={num.toString()}
                                />
                              )}
                            </span>
                          );
                        }
                        return <span key={idx} className="break-words">{part}</span>;
                      })}

                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

            {/* =================================================================== */}
      {/* 13. DIAGRAM COMPLETION                                              */}
      {/* =================================================================== */}
      {qb.type === 'diagram_completion' && (
        <div className="space-y-6">

          {/* REMOVED: Diagram Title - now handled by shared "Block Titles" section */}

          {/* INDEPENDENT WORD BANK (Only if this diagram has options) */}
          {Array.isArray(qb.options) && qb.options.length > 0 && (
            <div className="bg-surface-container-low p-4 border border-outline rounded-m3-sm shadow-elev-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4">
                {qb.options.map((opt: any, i: number) => (
                  <div key={i} className="flex items-start text-on-surface text-[0.95em]">
                    <strong className="mr-2 text-primary w-[1.5em] shrink-0 text-right">{opt.id}</strong>
                    <span className="leading-snug">{opt.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagram Image - Larger, more prominent */}
          <div className="flex justify-center p-4 bg-surface-container border border-outline-variant rounded-m3-sm shadow-elev-1">
            {qb.diagram_url ? (
              <img
                src={qb.diagram_url}
                alt={qb.diagram_alt_text || "Diagram"}
                className="max-h-[400px] w-auto object-contain rounded-m3-sm"
              />
            ) : (
              <div className="h-48 w-full max-w-md flex items-center justify-center text-on-surface-variant border-2 border-dashed border-outline rounded-m3-sm text-[0.95em]">
                [Diagram Image Placeholder]
              </div>
            )}
          </div>

          {/* Answer Inputs - Super comfortable, spacious layout */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-2">
            {Array.isArray(qb.questions) && qb.questions.map((q: any, i: number) => {
              const hasWordBank = Array.isArray(qb.options) && qb.options.length > 0;

              return (
                <div key={i} className="flex items-center gap-3" id={`question-${q?.question_number || i}`}>

                  {/* Question number badge - slightly larger */}
                  <span className="flex items-center justify-center bg-primary text-on-primary font-bold rounded-m3-xs text-[0.85em] w-[1.8em] h-[1.8em] shrink-0">
                    {q.question_number || '?'}
                  </span>

                  {hasWordBank ? (
                    <select
                      value={answers[q.question_number] || ''}
                      onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                      className="min-w-[6em] h-[2.2em] border-b-[2.5px] border-outline font-bold bg-transparent outline-none focus:border-primary cursor-pointer text-center text-[1em] text-primary transition-colors px-2"
                    >
                      <option value="">Select...</option>
                      {qb.options.map((opt: any, optIdx: number) => (
                        <option key={optIdx} value={opt.id}>{opt.id}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[q.question_number] || ''}
                      onChange={(e) => handleAnswerChange(q.question_number, e.target.value)}
                      className="min-w-[12em] h-[2.2em] border-b-[2.5px] border-outline font-bold bg-transparent outline-none focus:border-primary placeholder:text-on-surface-variant text-[1em] text-primary transition-colors px-2"
                      placeholder={`Answer ${q.question_number}...`}
                    />
                  )}

                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
