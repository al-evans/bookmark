import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export const DEFAULT_AI_PROVIDER = 'google';

const PROVIDERS = {
  google: {
    id: 'google',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    keyEnvVars: ['AI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    createProvider: (apiKey) => createGoogleGenerativeAI({ apiKey }),
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    keyEnvVars: ['AI_API_KEY', 'OPENAI_API_KEY'],
    createProvider: (apiKey) => createOpenAI({ apiKey }),
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-latest',
    keyEnvVars: ['AI_API_KEY', 'ANTHROPIC_API_KEY'],
    createProvider: (apiKey) => createAnthropic({ apiKey }),
  },
};

export const SUPPORTED_AI_PROVIDERS = Object.keys(PROVIDERS);

export function getAiProviderId() {
  const requested = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (!requested) return DEFAULT_AI_PROVIDER;
  return Object.hasOwn(PROVIDERS, requested) ? requested : DEFAULT_AI_PROVIDER;
}

function getProviderConfig() {
  return PROVIDERS[getAiProviderId()];
}

export function getAiProviderLabel() {
  return getProviderConfig().label;
}

export function getAiApiKey() {
  const { keyEnvVars } = getProviderConfig();
  for (const envVar of keyEnvVars) {
    const value = String(process.env[envVar] || '').trim();
    if (value) return value;
  }
  return '';
}

export function isAiConfigured() {
  return Boolean(getAiApiKey());
}

export function getAiModelId() {
  const override = String(process.env.AI_MODEL || '').trim();
  return override || getProviderConfig().defaultModel;
}

export function getAiTimeoutMs() {
  const raw = process.env.AI_TIMEOUT_MS ?? process.env.GEMINI_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

export function missingAiKeyMessage() {
  const { keyEnvVars, label } = getProviderConfig();
  return `${label} key missing. Set one of ${keyEnvVars.join(', ')} in your environment.`;
}

export function aiRequestFailedMessage() {
  return `${getAiProviderLabel()} request failed.`;
}

export function aiTimeoutMessage() {
  return `${getAiProviderLabel()} request timed out.`;
}

/**
 * Resolves the configured provider into an AI SDK language model.
 * Throws when no API key is present so callers can surface a 503.
 */
export function getLanguageModel() {
  const apiKey = getAiApiKey();
  if (!apiKey) {
    throw new Error(missingAiKeyMessage());
  }

  const { createProvider } = getProviderConfig();
  return createProvider(apiKey)(getAiModelId());
}
