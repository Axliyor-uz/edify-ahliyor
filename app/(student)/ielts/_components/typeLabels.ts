// Short universal labels for IELTS question types (exam jargon — same in uz/ru/en).
// Used by the practice-library type-mix chips and the weak-types card.

export const IELTS_TYPE_LABELS: Record<string, string> = {
  matching_headings: 'Headings',
  true_false_not_given: 'T/F/NG',
  multiple_choice: 'MCQ',
  summary_completion: 'Summary',
  matching_paragraph_information: 'Para info',
  list_selection: 'List',
  matching_features: 'Features',
  sentence_completion: 'Sentence',
  matching_sentence_endings: 'Endings',
  short_answer: 'Short answer',
  table_completion: 'Table',
  flowchart_completion: 'Flowchart',
  diagram_completion: 'Diagram',
};

export function typeLabel(type: string): string {
  return IELTS_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}
