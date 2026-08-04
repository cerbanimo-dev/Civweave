import { activeProvider, publicConfig } from './vault.js';

function extractJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || raw;
  const first = fenced.indexOf('{');
  const last = fenced.lastIndexOf('}');
  if (first < 0 || last <= first) throw new Error('The AI response did not contain a JSON object.');
  return JSON.parse(fenced.slice(first, last + 1));
}

function endpointFor(provider) {
  const endpoint = String(provider.endpoint || '').replace(/\/$/, '');
  if (!endpoint) throw new Error(`${provider.name} needs an endpoint.`);
  if (/\/chat\/completions$/i.test(endpoint)) return endpoint;
  return `${endpoint}/chat/completions`;
}

async function callGemini(provider, messages, options = {}) {
  const model = provider.model || 'gemini-2.5-flash';
  if (!provider.apiKey) throw new Error('Gemini API key is missing.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const body = {
    contents: messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
    generationConfig: {
      temperature: Number(options.temperature ?? 0.3),
      responseMimeType: options.json ? 'application/json' : 'text/plain'
    }
  };
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini returned ${response.status}.`);
  return payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim() || '';
}

async function callCompatible(provider, messages, options = {}) {
  const headers = { 'content-type': 'application/json' };
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
  const response = await fetch(endpointFor(provider), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model || 'local-model',
      messages,
      temperature: Number(options.temperature ?? 0.3),
      response_format: options.json ? { type: 'json_object' } : undefined
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `AI source returned ${response.status}.`);
  return payload?.choices?.[0]?.message?.content || payload?.output_text || payload?.text || '';
}

export async function ask({ system = 'commonweave', prompt, context = '', json = false, research = false, temperature = 0.3 }) {
  const provider = activeProvider({ research });
  if (!provider) return { ok: false, local: true, reason: 'No generative provider is unlocked.' };
  const systemPrompt = [
    `You are the ${system} assistant inside Commonweave.`,
    'Preserve user agency, mark assumptions, do not invent completed work, and never reveal or request stored API secrets.',
    'Return only the requested output shape.',
    context
  ].filter(Boolean).join('\n\n');
  const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: String(prompt || '') }];
  const text = provider.type === 'gemini'
    ? await callGemini(provider, messages, { json, temperature })
    : await callCompatible(provider, messages, { json, temperature });
  return {
    ok: true,
    local: false,
    provider: { id: provider.id, name: provider.name, type: provider.type, model: provider.model },
    text,
    data: json ? extractJson(text) : null
  };
}

export async function askJson(options) {
  const result = await ask({ ...options, json: true });
  if (!result.ok) return result;
  return { ...result, data: result.data || extractJson(result.text) };
}

export function aiStatus() {
  return publicConfig();
}
