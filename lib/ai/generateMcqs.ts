import { generateJson, type AiImage } from './generate';
import { MCQ_SCHEMA, checkMcqItems, cleanMcqItems, type AiPrompt, type McqItem } from './questionPrompts';
import type { AiFeature } from './models';

/**
 * MCQs from one of the prompt builders, checked by `checkMcqItems` (solution
 * agrees with the answer). If questions were dropped or missing, asks ONCE more
 * for just the missing number. A failure on the retry keeps what the first call
 * gave; a failure on the first call throws, as `generateJson` does.
 * Server only.
 */
export async function generateMcqs({ build, count, language, feature = 'questions', images }: {
  /** The prompt for `n` questions (the builders in questionPrompts.ts). */
  build: (n: number) => AiPrompt;
  count: number;
  language: string;
  feature?: AiFeature;
  images?: AiImage[];
}): Promise<McqItem[]> {
  const items: McqItem[] = [];
  for (let round = 0; round < 2 && items.length < count; round++) {
    try {
      const { prompt, temperature } = build(count - items.length);
      const raw = await generateJson<McqItem[]>({ feature, prompt, temperature, schema: MCQ_SCHEMA, images });
      items.push(...checkMcqItems(cleanMcqItems(raw), language));
    } catch (error) {
      if (!items.length) throw error;
      console.error('AI retry for dropped questions failed:', error);
      break;
    }
  }
  return items.slice(0, count);
}
