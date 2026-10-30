import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, CLAUDE_EFFORT, aiModelFor, aiProviderFor, type AiFeature, type AiProvider } from './models';

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
 * - Claude: the official SDK, streamed. Structured outputs enforce the JSON
 *   (the Gemini schema is converted to JSON Schema, wrapped as `{ data: … }`).
 *   `temperature` is not sent (current Claude models reject it); thinking
 *   depth is `CLAUDE_EFFORT` instead.
 *
 * The prompt text itself is passed through unchanged on every provider.
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

const KEY_NAMES: Record<AiProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
};

const keyFor = (feature: AiFeature) => {
  const name = KEY_NAMES[aiProviderFor(feature)];
  const key = process.env[name];
  if (!key) throw new AiError('NO_KEY', `${name} is missing in .env.local`);
  return key;
};

const geminiUrl = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

/** The parts of a Gemini reply we read. */
interface GeminiReply {
  error?: { message?: string };
  candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
}

/** Gemini "busy" answers: overloaded (503) or rate-limited (429). */
const BUSY = [429, 503];

/**
 * One Gemini call. When the feature has its own model (e.g. images on
 * gemini-3.5-flash) and that model is busy, it retries once on the
 * provider's default model, so teachers don't get an error at peak times.
 */
async function geminiPost(feature: AiFeature, body: Record<string, unknown>): Promise<{ res: Response; data: GeminiReply }> {
  const key = keyFor(feature);
  const post = async (model: string) => {
    const res = await fetch(geminiUrl(model, key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { res, data: await res.json().catch(() => ({})) };
  };
  const model = aiModelFor(feature);
  const first = await post(model);
  const fallback = AI_MODELS.gemini;
  if (BUSY.includes(first.res.status) && fallback !== model) {
    console.warn(`Gemini ${model} busy (${first.res.status}) — retrying on ${fallback}`);
    return post(fallback);
  }
  return first;
}

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

/** Room for 30 questions with LaTeX plus thinking; streamed, so no HTTP timeout. */
const CLAUDE_MAX_TOKENS = 32000;
/** Models that accept `fallbacks: "default"` (a safety decline is retried server-side). */
const CLAUDE_FALLBACK_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'];

let anthropic: Anthropic | null = null;

/** Gemini schema (OBJECT/ARRAY/STRING…) → JSON Schema for Claude structured outputs. */
function toJsonSchema(schema: AiSchema): Record<string, unknown> {
  const type = String(schema.type ?? 'STRING').toLowerCase();
  const out: Record<string, unknown> = { type: schema.nullable ? [type, 'null'] : type };
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (type === 'array') out.items = toJsonSchema((schema.items ?? {}) as AiSchema);
  if (type === 'object') {
    out.properties = Object.fromEntries(
      Object.entries((schema.properties ?? {}) as Record<string, AiSchema>).map(([k, v]) => [k, toJsonSchema(v)]),
    );
    if (Array.isArray(schema.required)) out.required = schema.required;
    out.additionalProperties = false;
  }
  return out;
}

async function claude(feature: AiFeature, {
  system,
  messages,
  schema,
}: {
  system?: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  schema?: Record<string, unknown>;
}): Promise<string> {
  anthropic ??= new Anthropic({ apiKey: keyFor(feature) });
  const model = aiModelFor(feature);
  const fallback = CLAUDE_FALLBACK_MODELS.includes(model);
  try {
    const reply = await anthropic.beta.messages
      .stream({
        model,
        max_tokens: CLAUDE_MAX_TOKENS,
        ...(system ? { system } : {}),
        messages,
        output_config: { effort: CLAUDE_EFFORT, ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
        ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      })
      .finalMessage();
    if (reply.stop_reason === 'refusal') throw new AiError('SAFETY');
    if (reply.stop_reason === 'max_tokens') throw new AiError('TRUNCATED');
    const text = reply.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    if (!text.trim()) throw new AiError('EMPTY');
    return text;
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AiError('HTTP', err.message || `Claude request failed (${err.status})`);
    throw err;
  }
}

/**
 * JSON of the given schema. Gemini and Claude enforce the schema; DeepSeek is told it.
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
    const { res, data } = await geminiPost(feature, {
      contents: [{ parts: [{ text: prompt }, ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } }))] }],
      generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    });
    if (!res.ok) throw new AiError('HTTP', data?.error?.message || `Gemini request failed (${res.status})`);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AiError(data?.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : 'EMPTY');
    return JSON.parse(text) as T;
  }

  if (aiProviderFor(feature) === 'claude') {
    const text = await claude(feature, {
      messages: [{
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: img.data },
          })),
          { type: 'text' as const, text: prompt },
        ],
      }],
      // Root must be an object, so an array answer is wrapped as { data: … }.
      schema: { type: 'object', properties: { data: toJsonSchema(schema) }, required: ['data'], additionalProperties: false },
    });
    return JSON.parse(text).data as T;
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
    const { res, data } = await geminiPost(feature, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
    });
    if (!res.ok) throw new AiError('HTTP', data?.error?.message || `Gemini request failed (${res.status})`);
    const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? '').join('');
    if (!text) throw new AiError(data?.candidates?.[0]?.finishReason === 'SAFETY' ? 'SAFETY' : 'EMPTY');
    return text;
  }

  if (aiProviderFor(feature) === 'claude') {
    const turns: Anthropic.Beta.BetaMessageParam[] = [
      ...history.map((turn) => ({ role: turn.role === 'model' ? 'assistant' as const : 'user' as const, content: turn.parts.map((p) => p.text).join('') })),
      { role: 'user' as const, content: message },
    ].filter((turn) => turn.content.trim());
    // Claude needs a user turn first; the analytics chat history opens with the AI's summary.
    if (turns[0]?.role === 'assistant') turns.unshift({ role: 'user', content: 'Tahlil qiling.' });
    return claude(feature, { system, messages: turns });
  }

  return deepseek(feature, {
    messages: [
      { role: 'system', content: system },
      ...history.map((turn) => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: turn.parts.map((p) => p.text).join('') })),
      { role: 'user', content: message },
    ],
  });
}
