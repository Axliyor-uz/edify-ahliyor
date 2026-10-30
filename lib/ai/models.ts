/**
 * ⭐ THE ONE PLACE TO CHOOSE THE AI (docs/AI.md → "Provider switch").
 *
 * Every AI route (question generators, the classroom games, analytics chat,
 * IELTS writing) and every saved `metadata.aiModel` label read from here.
 * Safe in the browser: no keys, just names. Keys live in .env.local:
 * GEMINI_API_KEY for 'gemini', DEEPSEEK_API_KEY for 'deepseek',
 * ANTHROPIC_API_KEY for 'claude'.
 * DeepSeek models: deepseek-v4-pro (text only), deepseek-flash (reads images).
 * Claude models: claude-sonnet-5-5, claude-opus-5-5, claude-haiku-5-5 (all read images).
 */

export type AiProvider = 'gemini' | 'deepseek' | 'claude';

/** Switch everything at once: 'gemini', 'deepseek' or 'claude'. */
export const AI_PROVIDER: AiProvider = 'claude'; // <== CHANGE THIS TO SWITCH PROVIDERS

/** The default model of each provider. */
export const AI_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-3.5-flash',
  deepseek: 'deepseek-v4-pro',
  claude: 'claude-sonnet-5-5',
};

/**
 * Claude only: how hard it thinks before answering (low | medium | high | xhigh | max).
 * Lower = faster + cheaper; raise it if question quality drops.
 */
export const CLAUDE_EFFORT: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'medium';

interface FeatureAi {
  provider: AiProvider;
  /** Optional: this feature's own model instead of the provider's default. */
  model?: string;
}

/**
 * Per feature. `{ provider: AI_PROVIDER }` follows the switch above; write
 * 'gemini' / 'deepseek' / 'claude' (and optionally a `model`) to pin one feature.
 */
export const AI_FEATURES: Record<'questions' | 'images' | 'analytics' | 'ielts', FeatureAi> = {
  /** Every text question generator (create/* + the classroom games). */
  questions: { provider: AI_PROVIDER },
  /**
   * Questions from photos (create/by_image) — the model MUST read images (Gemini or any Claude).
   * Follows the switch while it is 'claude'; if you switch to 'deepseek', pin this back to
   * { provider: 'gemini', model: 'gemini-3.5-flash' } — deepseek-v4-pro cannot read images.
   */
  images: { provider: AI_PROVIDER },
  /** Analytics mentor chat (/api/analyze). */
  analytics: { provider: AI_PROVIDER },
  /** IELTS writing band estimate. */
  ielts: { provider: AI_PROVIDER },
};

export type AiFeature = keyof typeof AI_FEATURES;

export const aiProviderFor = (feature: AiFeature): AiProvider => AI_FEATURES[feature].provider;

/** The model name a feature runs on — also what is saved as `metadata.aiModel`. */
export const aiModelFor = (feature: AiFeature): string => AI_FEATURES[feature].model ?? AI_MODELS[AI_FEATURES[feature].provider];
