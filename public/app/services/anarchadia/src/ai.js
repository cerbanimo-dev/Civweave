import { ARTICLE_INDEX, HIGH_IMPACT_TERMS, nowIso, uid } from './domain.js';

const SYSTEM = `You are a constitutional drafting assistant inside Anarchadia Charter Forge.
You may summarize, compare, translate, identify missing fields, surface ambiguity, draft alternatives, and propose exact text.
You must never claim that software, AI, votes, signatures, timestamps, cryptography, or records establish legitimacy, consensus, rights compliance, identity, authority, or ratification.
Preserve dissent, refusal, export, exit, fork, offline paths, privacy, bounded and recallable power, human review, and the no-build option.
Treat any effect on necessities, standing, wages, identity, private choice, exclusion, resources, production, or nonparticipants as potentially rights-critical.
Do not profile participants, infer motives, score people, recommend a political ideology, or optimize engagement.
Return a concise advisory response. Clearly label unknowns, risks, and proposed text. Do not imply that your draft has been adopted.`;

function compactContext(context) {
  const raw = JSON.stringify(context, null, 2);
  return raw.length > 22000 ? `${raw.slice(0, 22000)}\n[context truncated locally]` : raw;
}

function taskPrompt(task, context, instruction = '') {
  instruction = String(instruction || '').slice(0, 12000);
  const taskMap = {
    'plain-language': 'Rewrite the supplied text into a short accessible layer. Preserve exact authority, affected people, effects, duration, refusal, assistance, correction, contest, export, exit, privacy consequences, remedy, and unknowns. Do not weaken protections.',
    'rights-scan': 'Inspect for rights, power, privacy, labor, accessibility, continuity, dissent, replacement, expiry, remedy, and no-build gaps. Separate blockers from questions and optional improvements.',
    'compare': 'Compare the alternatives without ranking or recommending them. Give equivalent fields, visual weight, benefits, burdens, suitable uses, unsuitable uses, power created, privacy implications, offline behavior, and unresolved gaps.',
    'draft-section': 'Draft a charter section from the supplied intent. Use visible bounded language, human authority, equal-effect offline paths, dissent, expiry, review, remedy, export, exit, and replaceability where relevant.',
    'proposal-card': 'Turn the supplied idea into a non-certifying proposal record: purpose, affected people, authority or power effects, procedure and threshold as declared text, silence/abstention, dissent, appeal, expiry, reconsideration, offline path, labor, privacy, risks, and no-software alternative.',
    'threat-model': 'Create a small threat register. For each threat include adversary, harm, tested protection, method and threshold, outcome placeholder, residual uncertainty, monitored failure, support, recovery or abandonment, retest trigger, and proposed disposition.',
    'bridge-review': 'Review this default-off one-direction bridge contract for prohibited linkage, excessive fields, re-identification, retries/caches, expiry, correction, revocation, failure-closed behavior, manual alternative, and governance effects.',
    'exact-diff-review': 'Review the before/after amendment. Identify rights, power, data, labor, material, dependency, remedy, uncertainty, dissent, expiry, rollback, transition, and irreversible effects. Do not certify classification.',
    'freeform': instruction || 'Answer the participant’s drafting or analysis request within the constitutional boundaries.'
  };
  return `${taskMap[task] || taskMap.freeform}\n\nParticipant instruction:\n${instruction || '[none]'}\n\nLocal context:\n${compactContext(context)}`;
}

function safeProviderUrl(value, { gemini = false } = {}) {
  let url;
  try { url = new URL(String(value || ''), location.href); }
  catch { throw new Error('The provider endpoint is not a valid URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Provider endpoints must use HTTP or HTTPS.');
  if (gemini && (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com')) {
    throw new Error("Gemini API keys may only be sent to Google's HTTPS API host.");
  }
  return url;
}

async function boundedResponseText(response, maxBytes = 5_000_000) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error('The provider response is too large.');
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('The provider response is too large.');
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error('The provider response is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function parseProviderJson(text) {
  try { return JSON.parse(text || '{}'); }
  catch { throw new Error('The provider did not return valid JSON.'); }
}

function providerTimeout(value) {
  const timeout = Number(value);
  return Number.isFinite(timeout) ? Math.max(5000, Math.min(300000, timeout)) : 90000;
}

function deterministic(task, context, instruction = '') {
  const text = typeof context === 'string' ? context : JSON.stringify(context, null, 2);
  const lower = text.toLowerCase();
  const signals = HIGH_IMPACT_TERMS.filter(term => lower.includes(term));
  const missing = [];
  const checks = [
    ['offline', 'equal-effect offline or assisted path'],
    ['dissent', 'dissent preservation'],
    ['expiry', 'expiry or reconsideration condition'],
    ['appeal', 'appeal or independent review'],
    ['export', 'selective export'],
    ['exit', 'exit or fork'],
    ['remedy', 'remedy or restoration'],
    ['backup', 'replaceable backup role'],
    ['retention', 'retention and deletion limits'],
    ['no software', 'no-software alternative']
  ];
  for (const [needle, label] of checks) if (!lower.includes(needle)) missing.push(label);
  const excerpt = text.replace(/\s+/g, ' ').trim().slice(0, 620);
  if (task === 'plain-language') {
    return `## Accessible layer\n\n${excerpt || 'No source text was supplied.'}\n\n## Locate before relying\n\n- Who is affected and what changes\n- Who may act, for how long, and under what limit\n- How to refuse, defer, request assistance, correct, contest, export, and exit\n- What data is kept, who can see it, and what copies may remain\n- What remedy and independent review exist\n\nThis draft records a proposed explanation only. It establishes no authority or consent.`;
  }
  if (task === 'proposal-card') {
    return `## Non-certifying proposal card\n\n**Purpose:** ${instruction || excerpt || '[state the bounded purpose]'}\n\n**Affected people:** [name people who may benefit, bear burdens, be excluded, or be absent]\n\n**Declared procedure:** [community-provided text; not computed by software]\n\n**Silence and abstention:** [state explicitly]\n\n**Dissent and appeal:** Preserve dissenter-chosen disclosure and provide independent human review.\n\n**Expiry / reconsideration:** [locally knowable condition]\n\n**Offline path:** [paper or assisted equal-effect path]\n\n**Labor and funding:** [facilitation, translation, accessibility, custody, reconciliation, replacement]\n\n**No-software alternative:** [paper, existing tool, facilitation, or no build]\n\n**Classification signal:** ${signals.length ? `Potentially rights-critical: ${signals.join(', ')}` : 'No automatic signal found; affected people may still challenge classification.'}`;
  }
  return `## Local advisory scan\n\n**Task:** ${task}\n\n**Potential rights-critical signals:** ${signals.length ? signals.join(', ') : 'None automatically detected. This is not a clearance.'}\n\n**Missing or hard-to-locate protections:**\n${missing.length ? missing.map(item => `- ${item}`).join('\n') : '- Core protections were located by a simple phrase scan. Human review is still required.'}\n\n**Questions for affected humans:**\n- What changes materially, for whom, and who remains unheard?\n- Which role gains power, who funds the work, and how is that role replaced?\n- What happens during outage, conflict, expiry, withdrawal, or device loss?\n- What lower-burden paper, existing-tool, or no-software path remains available?\n\n**Caution:** This deterministic scan is intentionally shallow. It cannot establish legitimacy, voluntariness, safety, compliance, or ratification.`;
}

async function callOpenAICompatible(prompt, config) {
  const endpoint = String(config.endpoint || '').replace(/\/$/, '');
  if (!endpoint) throw new Error('An OpenAI-compatible endpoint is required.');
  const url = safeProviderUrl(endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`).href;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeout(config.timeoutMs));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: config.model || 'local-model',
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt }
        ]
      }),
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store'
    });
    const responseText = await boundedResponseText(response);
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}: ${responseText.slice(0, 500)}`);
    const data = parseProviderJson(responseText);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Provider response did not contain choices[0].message.content.');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(prompt, config) {
  if (!config.apiKey) throw new Error('A Gemini API key is required for this session.');
  const model = config.model || 'gemini-3.6-flash';
  const base = safeProviderUrl(String(config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, ''), { gemini: true }).href.replace(/\/$/, '');
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeout(config.timeoutMs));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      }),
      signal: controller.signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store'
    });
    const responseText = await boundedResponseText(response);
    if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}: ${responseText.slice(0, 500)}`);
    const data = parseProviderJson(responseText);
    const content = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n').trim();
    if (!content) throw new Error(data?.promptFeedback?.blockReason ? `Gemini blocked the prompt: ${data.promptFeedback.blockReason}` : 'Gemini response contained no text.');
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function callSuiteBridge(prompt, config) {
  return new Promise((resolve, reject) => {
    const requestId = uid('ai');
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('The Cerbanimo suite AI broker did not answer.'));
    }, providerTimeout(config.timeoutMs));
    const onEvent = event => {
      if (event.detail?.requestId !== requestId) return;
      cleanup();
      if (event.detail.error) reject(new Error(event.detail.error));
      else resolve(event.detail.text || '');
    };
    const onMessage = event => {
      if (event.origin !== location.origin || event.source !== window.parent) return;
      if (event.data?.type !== 'anarchadia:ai-response' || event.data.requestId !== requestId) return;
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.text || '');
    };
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener('anarchadia:ai-response', onEvent);
      window.removeEventListener('message', onMessage);
    };
    window.addEventListener('anarchadia:ai-response', onEvent);
    window.addEventListener('message', onMessage);
    const detail = {
      type: 'anarchadia:ai-request', requestId, system: SYSTEM, prompt,
      capability: 'constitutional-advisory', model: config.model || 'suite-default'
    };
    window.dispatchEvent(new CustomEvent('anarchadia:ai-request', { detail }));
    if (window.parent && window.parent !== window) window.parent.postMessage(detail, location.origin);
  });
}

export async function runAssistant({ task = 'rights-scan', context = {}, instruction = '', config = {} }) {
  const prompt = taskPrompt(task, context, instruction);
  const requestedProvider = config.provider || 'deterministic';
  let text;
  let provider = requestedProvider;
  let model = config.model || (requestedProvider === 'deterministic' ? 'local-constitutional-linter' : 'provider-default');
  let runtimeResult = null;

  if (requestedProvider === 'deterministic') {
    text = deterministic(task, context, instruction);
  } else if (globalThis.CommonweaveModelRuntime) {
    const runtime = globalThis.CommonweaveModelRuntime;
    const mappedProvider = requestedProvider === 'suite-bridge'
      ? 'hosted'
      : requestedProvider === 'openai-compatible'
        ? 'openai-compatible'
        : requestedProvider;
    const agenticTask = /(?:research|search|source|url|web|youtube|background|threat-model|exact-diff-review)/i.test(String(task));
    const runtimeGenerate = agenticTask && runtime.generateAgentic ? runtime.generateAgentic.bind(runtime) : (runtime.generateInteractive || runtime.generate).bind(runtime);
    runtimeResult = await runtimeGenerate({
      purpose: `anarchadia-${task}`,
      executionProfile: agenticTask ? 'agentic' : 'interactive',
      background: agenticTask,
      requiresTools: agenticTask,
      config: {
        provider: mappedProvider,
        route: requestedProvider,
        model,
        endpoint: config.endpoint || config.baseUrl || '',
        apiKey: config.apiKey || '',
        externalConsent: Boolean(config.externalConsent),
        timeoutMs: config.timeoutMs || 90000,
        temperature: 0.2,
        maxTokens: 4096,
        stream: true,
        service: 'anarchadia'
      },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt }
      ],
      responseFormat: 'text',
      requireExternalConsent: requestedProvider !== 'suite-bridge',
      maxRepairAttempts: 0,
      transport: requestedProvider === 'suite-bridge'
        ? async () => ({ text: await callSuiteBridge(prompt, config), provider: 'hosted', model })
        : undefined
    });
    if (!['success','fallback'].includes(runtimeResult.status)) {
      throw new Error(runtimeResult.error?.message || `Shared model runtime ended with ${runtimeResult.status}.`);
    }
    text = runtimeResult.outputText;
    provider = runtimeResult.actual?.provider || mappedProvider;
    model = runtimeResult.actual?.model || model;
  } else if (requestedProvider === 'openai-compatible') {
    text = await callOpenAICompatible(prompt, config);
  } else if (requestedProvider === 'gemini') {
    text = await callGemini(prompt, config);
  } else if (requestedProvider === 'suite-bridge') {
    text = await callSuiteBridge(prompt, config);
  } else {
    text = deterministic(task, context, instruction);
    provider = 'deterministic';
    model = 'local-constitutional-linter';
  }

  return {
    id: uid('aidraft'),
    createdAt: nowIso(),
    provider,
    model,
    task,
    instruction,
    text,
    status: 'advisory-draft',
    runtime: runtimeResult ? {
      schema: runtimeResult.schema,
      status: runtimeResult.status,
      streamed: Boolean(runtimeResult.stream?.used),
      elapsedMs: runtimeResult.timing?.elapsedMs || 0,
      fallback: Boolean(runtimeResult.fallback?.used),
      diagnostics: runtimeResult.diagnostics || []
    } : null,
    constitutionArticles: ARTICLE_INDEX.map(item => item.article),
    disclaimer: 'AI output is an advisory draft. It has no authority and changes no record until a person explicitly applies or copies it.'
  };
}
