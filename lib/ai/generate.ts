import { aiModelFor, aiProviderFor, type AiFeature } from './models';

/**
 * The one way server code talks to the AI (docs/AI.md → "Provider switch").
 * The provider and model come from lib/ai/models.ts; callers never name them.
 *
 * - Gemini: the same REST request the routes always sent (`responseSchema`
 *   enforces the JSON shape).
 * - DeepSeek: OpenAI-style chat with `response_format: json_object`. It has
 *   no schema enforcement, so the expected shape goes in a system message and
 *   the answer comes back wrapped as `{ "data": … }`. Thinking mode is turned
 *   off: faster, and `temperature` only works without it.
 *
 * The prompt text itself is passed through unchanged on both providers.
 * Server only — reads the API keys.
 */

/** A Gemini `responseSchema` (OBJECT / ARRAY / STRING / INTEGER / NUMBER / BOOLEAN). */
export type AiSchema = Record<string, unknown>;

export interface AiImage {
  mimeType: string;
  /** Base64 without the `data:…;base64,` prefix. */
  data: string;
}

export type AiErrorCode = 'NO_KEY' | 'SAFETY' | 'EMPTY' | 'TRUNCATED' | 'HTTP';

const MESSAGES: Record<Exclude<AiErrorCode, 'HTTP'>, string> = {
  NO_KEY: 'AI kaliti sozlanmagan (.env.local).',
  SAFETY: "AI xavfsizlik filtri: Bu mavzu bo'yicha savol tuzish taqiqlangan.",
  EMPTY: "AI kutilmagan javob qaytardi. Qayta urinib ko'ring.",
  TRUNCATED: "AI javobi juda uzun bo'lib qoldi. Kamroq savol so'rang.",
};

export class AiError extends Error {
  constructor(public code: AiErrorCode, message?: string) {
    super(message ?? MESSAGES[code as Exclude<AiErrorCode, 'HTTP'>] ?? code);
  }
}

/** One chat turn, in the Gemini history shape the analytics page sends. */
export interface ChatTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
/** Room for 30 questions with LaTeX; DeepSeek's default (8K) can cut a set short. */
const DEEPSEEK_MAX_TOKENS = 16000;

const keyFor = (feature: AiFeature) => {
  const name = aiProviderFor(feature) === 'gemini' ? 'GEMINI_API_KEY' : 'DEEPSEEK_API_KEY';
  const key = process.env[name];
  if (!key) throw new AiError('NO_KEY', `${name} is missing in .env.local`);
  return key;
};

const geminiUrl = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

/** A placeholder value of the schema's shape — DeepSeek's JSON mode wants an example. */
function exampleOf(schema: AiSchema): unknown {
  switch (schema.type) {
    case 'ARRAY': return [exampleOf((schema.items ?? {}) as AiSchema)];
    case 'OBJECT':
      return Object.fromEntries(Object.entries((schema.properties ?? {}) as Record<string, AiSchema>).map(([k, v]) => [k, exampleOf(v)]));
    case 'INTEGER':
    case 'NUMBER': return 0;
    case 'BOOLEAN': return false;
    default: return '...';
  }
}

async function deepseek(feature: AiFeature, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyFor(feature)}` },
    body: JSON.stringify({ model: aiModelFor(feature), thinking: { type: 'disabled' }, max_tokens: DEEPSEEK_MAX_TOKENS, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError('HTTP', data?.error?.message || `DeepSeek request failed (${res.status})`);
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'content_filter') throw new AiError('SAFETY');
  if (choice?.finish_reason === 'length') throw new AiError('TRUNCATED');
  const text = choice?.message?.content;
  if (!text || !String(text).trim()) throw new AiError('EMPTY');
  return String(text);
}

/**
 * JSON of the given schema. Gemini enforces the schema; DeepSeek is told it.
 * Throws AiError, or SyntaxError if the text is not JSON.
 */
export async function generateJson<T = unknown>({ feature, prompt, temperature, schema, images = [] }: {
  feature: AiFeature;
  prompt: string;
  temperature: number;
  schema: AiSchema;
  images?: AiImage[];
}): Promise<T> {
  if (aiProviderFor(feature) === 'gemini') {
    const res = await fetch(geminiUrl(aiModelFor(feature), keyFor(feature)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } }))] }],
        generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AiError('HTTP', data?.error?.message || `Gemini request failed (${res.status})`);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AiError(data?.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : 'EMPTY');
    return JSON.parse(text) as T;
  }

  const shape = JSON.stringify({ data: exampleOf(schema) });
  const text = await deepseek(feature, {
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Reply with valid json only: ONE JSON object shaped exactly like this example, the answer inside "data":\n${shape}\nThe "data" value must follow this schema (Gemini schema notation):\n${JSON.stringify(schema)}`,
      },
      {
        role: 'user',
        content: images.length
          ? [{ type: 'text', text: prompt }, ...images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } }))]
          : prompt,
      },
    ],
  });
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === 'object' && 'data' in parsed) return parsed.data as T;
  // Model forgot the wrapper: an array answer may come as the only array field.
  if (schema.type === 'ARRAY' && parsed && typeof parsed === 'object') {
    const arrays = Object.values(parsed).filter(Array.isArray);
    if (arrays.length === 1) return arrays[0] as T;
  }
  return parsed as T;
}

/** Plain-text chat: a system instruction, earlier turns, and the new message. */
export async function generateChat({ feature, system, history = [], message }: {
  feature: AiFeature;
  system: string;
  history?: ChatTurn[];
  message: string;
}): Promise<string> {
  if (aiProviderFor(feature) === 'gemini') {
    const res = await fetch(geminiUrl(aiModelFor(feature), keyFor(feature)), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [...history, { role: 'user', parts: [{ text: message }] }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AiError('HTTP', data?.error?.message || `Gemini request failed (${res.status})`);
    const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? '').join('');
    if (!text) throw new AiError(data?.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : 'EMPTY');
    return text;
  }

  return deepseek(feature, {
    messages: [
      { role: 'system', content: system },
      ...history.map((turn) => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: turn.parts.map((p) => p.text).join('') })),
      { role: 'user', content: message },
    ],
  });
}
