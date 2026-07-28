// Short display labels for IELTS question types — used by the library-card
// type-breakdown chips on the reading/listening list pages.

export const TYPE_LABELS: Record<string, string> = {
  matching_headings: 'Headings',
  true_false_not_given: 'T/F/NG',
  multiple_choice: 'MCQ',
  summary_completion: 'Summary',
  matching_paragraph_information: 'Para Info',
  list_selection: 'List',
  matching_features: 'Features',
  sentence_completion: 'Sentence',
  matching_sentence_endings: 'Endings',
  short_answer: 'Short Ans',
  table_completion: 'Table',
  flowchart_completion: 'Flowchart',
  diagram_completion: 'Diagram',
};

/** { true_false_not_given: 7 } → ["7 × T/F/NG"] */
export function breakdownChips(breakdown: Record<string, number>): string[] {
  return Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} × ${TYPE_LABELS[type] || type}`);
}
