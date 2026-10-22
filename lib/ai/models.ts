/**
 * ⭐ THE ONE PLACE TO CHOOSE THE AI (docs/AI.md → "Provider switch").
 *
 * Every AI route (question generators, the classroom games, analytics chat,
 * IELTS writing) and every saved `metadata.aiModel` label read from here.
 * Safe in the browser: no keys, just names. Keys live in .env.local:
 * GEMINI_API_KEY for 'gemini', DEEPSEEK_API_KEY for 'deepseek'.
 * deepseek-v4-pro    deepseek-flash
 */

export type AiProvider = 'gemini' | 'deepseek';

/** Switch everything at once: 'gemini' or 'deepseek'. */
export const AI_PROVIDER: AiProvider = 'gemini';

/** The model each provider uses. */
export const AI_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-3.5-flash-lite',
  deepseek: 'deepseek-flash',
};

/**
 * Per feature — all follow AI_PROVIDER. To pin one feature, write
 * 'gemini' or 'deepseek' on its line instead.
 */
export const AI_FEATURES: Record<'questions' | 'images' | 'analytics' | 'ielts', AiProvider> = {
  /** Every text question generator (create/* + the classroom games). */
  questions: AI_PROVIDER,
  /** Questions from photos (create/by_image) — the model must read images. */
  images: AI_PROVIDER,
  /** Analytics mentor chat (/api/analyze). */
  analytics: AI_PROVIDER,
  /** IELTS writing band estimate. */
  ielts: AI_PROVIDER,
};

export type AiFeature = keyof typeof AI_FEATURES;

export const aiProviderFor = (feature: AiFeature): AiProvider => AI_FEATURES[feature];

/** The model name a feature runs on — also what is saved as `metadata.aiModel`. */
export const aiModelFor = (feature: AiFeature): string => AI_MODELS[AI_FEATURES[feature]];
