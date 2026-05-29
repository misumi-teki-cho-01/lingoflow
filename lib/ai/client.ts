import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// ── Model catalog ─────────────────────────────────────────────────────────

export type AIProvider = 'gemini' | 'openai' | 'deepseek';

export interface ModelOption {
  id: string; // unique key, e.g. "gemini-2.0-flash" or "gpt-5-mini"
  provider: AIProvider;
  model: string; // the provider-side model id
  label: string;
  hint?: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    hint: 'Cheapest, recommended',
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    label: 'OpenAI GPT-4o',
    hint: 'No reasoning overhead, ~$0.05/video',
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    model: 'gpt-5-mini',
    label: 'OpenAI GPT-5 mini',
    hint: 'Minimal reasoning, ~$0.02/video',
  },
  {
    id: 'deepseek-v4-flash',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    label: 'DeepSeek V4-flash',
    hint: 'Thinking disabled, ~$0.002/video',
  },
];

export const DEFAULT_MODEL_ID = 'gemini-2.0-flash';

export function resolveModel(id: string | undefined | null): ModelOption {
  const found = id ? MODEL_OPTIONS.find((m) => m.id === id) : null;
  return found ?? MODEL_OPTIONS.find((m) => m.id === DEFAULT_MODEL_ID)!;
}

// ── Provider clients (lazy) ───────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;
let deepseekClient: OpenAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getDeepSeekClient(): OpenAI {
  if (!deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }
    deepseekClient = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return deepseekClient;
}

// ── Unified text generation ───────────────────────────────────────────────

export interface GenerateOptions {
  modelId?: string;
}

/**
 * Unified text generation across providers. Returns the model's response as
 * plain text. Callers should strip any markdown fencing themselves.
 */
export async function generateAIText(
  prompt: string | string[],
  options: GenerateOptions = {},
): Promise<string> {
  const { provider, model } = resolveModel(options.modelId);
  const promptText = Array.isArray(prompt) ? prompt.join('\n') : prompt;

  if (provider === 'gemini') {
    const client = getGeminiClient();
    const m = client.getGenerativeModel({ model });
    const result = await m.generateContent(promptText);
    return result.response.text();
  }

  // openai / deepseek (DeepSeek is OpenAI-compatible — same SDK, different baseURL)
  const client = provider === 'deepseek' ? getDeepSeekClient() : getOpenAIClient();
  // For GPT-5 family models, default to minimal reasoning effort. The
  // grouping/cleanup task is mechanical and doesn't benefit from reasoning,
  // which is billed at output token rates and can multiply cost 5-10x.
  const isGpt5 = provider === 'openai' && model.startsWith('gpt-5');

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [{ role: 'user', content: promptText }],
  };
  if (isGpt5) {
    (params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
      reasoning_effort: string;
    }).reasoning_effort = 'minimal';
  }
  // DeepSeek V4 defaults to thinking enabled — disable it for the same reason.
  if (provider === 'deepseek') {
    (params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
      thinking: { type: string };
    }).thinking = { type: 'disabled' };
  }

  const response = await client.chat.completions.create(params);
  return response.choices[0]?.message?.content ?? '';
}

// ── Back-compat shim (used by callers that still want a Gemini model) ────

export function getGemini2_0FlashModel() {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: 'gemini-2.0-flash' });
}

/**
 * Legacy helper. Prefer generateAIText.
 */
export async function generateText(prompt: string | string[]): Promise<string> {
  return generateAIText(prompt);
}
