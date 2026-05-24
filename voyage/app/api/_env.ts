export function getDuffelToken(): string {
  const v = process.env.DUFFEL_ACCESS_TOKEN;
  if (!v) throw new Error('DUFFEL_ACCESS_TOKEN is missing. Add it to .env.');
  return v;
}

export function getGatewayKey(): string {
  const v = process.env.AI_GATEWAY_API_KEY;
  if (!v) throw new Error('AI_GATEWAY_API_KEY is missing. Add it to .env.');
  return v;
}

export function tryGatewayKey(): string | null {
  return process.env.AI_GATEWAY_API_KEY?.trim() || null;
}

const DEFAULT_GATEWAY_MODEL = 'anthropic/claude-sonnet-4';
const DEFAULT_TEST_GATEWAY_MODEL = 'openai/gpt-4.1-mini';

export function getGatewayModel(): string {
  const model = process.env.AI_GATEWAY_MODEL?.trim();
  if (model) return model;

  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  const testModel = process.env.AI_GATEWAY_TEST_MODEL?.trim();
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return testModel || DEFAULT_TEST_GATEWAY_MODEL;
  }

  return DEFAULT_GATEWAY_MODEL;
}

// NVIDIA NIM — free-tier OpenAI-compatible inference endpoint. Used as a
// fallback when AI_GATEWAY_API_KEY isn't set so dev/mock mode still gets a
// live LLM response. See https://build.nvidia.com — sign up, generate an API
// key, drop `NVIDIA_NIM_API_KEY=…` into `.env`.

const DEFAULT_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_NIM_MODEL = 'meta/llama-3.1-70b-instruct';

export function tryNimKey(): string | null {
  return process.env.NVIDIA_NIM_API_KEY?.trim() || null;
}

export function getNimBaseUrl(): string {
  return process.env.NVIDIA_NIM_BASE_URL?.trim() || DEFAULT_NIM_BASE_URL;
}

export function getNimModel(): string {
  return process.env.NVIDIA_NIM_MODEL?.trim() || DEFAULT_NIM_MODEL;
}

export function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default { getDuffelToken, getGatewayKey, getGatewayModel, jsonError };
