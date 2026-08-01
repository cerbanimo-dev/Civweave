const STOP = new Set(['the','a','an','and','or','to','of','for','with','in','on','at','is','are','be','can','could','would','should','i','we','you','my','our','your','this','that','it','from','as','by','need','offer','looking','available','help','local','locally']);
const SYNONYMS = {
  move: ['haul','transport','truck','pickup','delivery','carry','collect'],
  repair: ['fix','restore','broken','diagnose','maintenance'],
  build: ['carpentry','construct','fabricate','make','install'],
  food: ['meal','bread','produce','cook','bake','grocery'],
  clean: ['organize','reset','declutter','tidy'],
  space: ['workshop','studio','room','storage','venue'],
  teach: ['tutor','lesson','class','training','learn'],
  money: ['fund','grant','budget','cash','payment'],
  care: ['childcare','eldercare','pet','support','companion'],
  design: ['flyer','website','graphics','branding','layout'],
  ride: ['transport','drive','car','pickup','delivery'],
  tool: ['equipment','ladder','machine','gear'],
  garden: ['produce','compost','plants','greenhouse','yard']
};

export const DEFAULT_AI_SETTINGS = {
  enabled: true,
  provider: 'deterministic',
  endpoint: 'http://127.0.0.1:11434/v1',
  model: '',
  timeoutMs: 120000,
  rememberSecret: false,
  sendArea: false
};

export function normalizeAISettings(settings = {}) {
  return { ...DEFAULT_AI_SETTINGS, ...settings, timeoutMs: Math.max(15000, Number(settings.timeoutMs || DEFAULT_AI_SETTINGS.timeoutMs)) };
}

function tokens(text = '') {
  return [...new Set(String(text).toLowerCase().replace(/[^a-z0-9$]+/g,' ').split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word)).flatMap((word) => {
    const root = word.replace(/(ing|ed|es|s)$/,'');
    const related = Object.entries(SYNONYMS).find(([key, list]) => key === root || list.includes(root));
    return related ? [root, related[0], ...related[1]] : [root];
  }))];
}

function overlap(a, b) {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  const shared = [...left].filter((item) => right.has(item));
  return { count: shared.length, shared };
}

function complementary(a, b) {
  if (a === 'need') return b === 'offer' || b === 'collective';
  if (a === 'offer') return b === 'need' || b === 'collective';
  return b !== a || b === 'offer';
}

export function deterministicDraft(text, mode = 'need') {
  const clean = String(text || '').trim().replace(/\s+/g,' ');
  const lower = clean.toLowerCase();
  const amountMatch = clean.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g,'')) : '';
  const categoryRules = [
    ['Transport', /(truck|ride|drive|deliver|haul|move|transport|pickup)/],
    ['Repair', /(repair|fix|broken|leak|diagnos|restore|maintenance)/],
    ['Food', /(food|bread|meal|cook|produce|vegetable|garden|bake|grocery)/],
    ['Tools & space', /(tool|workshop|space|room|ladder|equipment|studio|storage)/],
    ['Learning', /(teach|learn|lesson|class|tutor|training|apprentice)/],
    ['Housing', /(apartment|house|housing|rent|shelter|roommate)/],
    ['Funding', /(fund|donat|grant|crowdfund|money|capital)/],
    ['Work', /(job|work|gig|shift|hire me|employment|labor)/],
    ['Services', /(design|organize|clean|care|consult|help|website|childcare)/],
    ['Goods', /(buy|sell|item|window|sofa|bike|material|furniture|clothes)/]
  ];
  const category = categoryRules.find(([,regex]) => regex.test(lower))?.[0] || 'Other';
  const timeMatch = clean.match(/\b(today|tomorrow|tonight|this weekend|next week|this month|saturday|sunday|monday|tuesday|wednesday|thursday|friday|before [^,.]+)/i);
  const methods = [];
  if (amount) methods.push('Cash');
  if (/trade|barter|swap/i.test(clean)) methods.push('Barter');
  if (/free|gift|give away|donate/i.test(clean)) methods.push('Gift');
  if (/credit/i.test(clean)) methods.push('Community credit');
  if (/borrow|loan|lend/i.test(clean)) methods.push('Loan');
  if (/pay what|sliding/i.test(clean)) methods.push('Pay what you can');
  if (!methods.length) methods.push(mode === 'offer' ? 'Cash' : 'Barter');
  const stripped = clean.replace(/^i\s+(need|want|am looking for|can offer|offer|have|could provide|would like)\s+/i, '');
  let title = stripped.split(' ').slice(0, 10).join(' ').replace(/[.,;:]$/,'');
  if (title.length > 76) title = `${title.slice(0,73)}…`;
  title = title ? title[0].toUpperCase() + title.slice(1) : mode;
  const questions = [];
  if (!amount && !/(gift|free|barter|trade|loan)/i.test(clean)) questions.push('What budget, price, or non-cash terms are workable?');
  if (!timeMatch) questions.push('When is this needed or available?');
  if (!/\b(watertown|county|mile|local|remote|online|pickup|delivery|at my|at your)\b/i.test(clean)) questions.push('What area, delivery range, or remote option applies?');
  if (!/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+|hour|day|week|item|people|person|household)\b/i.test(clean)) questions.push('What quantity or duration would count as complete?');
  return {
    title,
    description: clean,
    category,
    amount,
    when: timeMatch?.[0] || '',
    methods,
    partial: /(several|multiple|any amount|part of|some of|two people|group|collective|households|pieces|combination)/i.test(clean) || mode === 'collective',
    quantity: clean.match(/\b(\d+\s+(?:people|hours?|days?|weeks?|items?|households?|windows?|loaves?|trips?))\b/i)?.[0] || '',
    questions,
    confidence: Math.min(96, 58 + (amount ? 10 : 0) + (timeMatch ? 10 : 0) + (category !== 'Other' ? 12 : 0))
  };
}

export function deterministicMatches(thread, threads = [], people = []) {
  const candidates = threads.filter((candidate) => candidate.id !== thread.id && candidate.status !== 'complete' && complementary(thread.mode, candidate.mode));
  return candidates.map((candidate) => {
    const textA = `${thread.title} ${thread.description} ${thread.category}`;
    const textB = `${candidate.title} ${candidate.description} ${candidate.category}`;
    const lexical = overlap(textA, textB);
    let score = lexical.count * 14;
    const reasons = [];
    if (thread.category === candidate.category) { score += 28; reasons.push(`Same ${thread.category.toLowerCase()} category`); }
    if (lexical.shared.length) reasons.push(`Shared intent: ${lexical.shared.slice(0,4).join(', ')}`);
    if ((thread.methods || []).some((method) => (candidate.methods || []).includes(method))) { score += 10; reasons.push('Compatible exchange method'); }
    if (thread.area && candidate.area && overlap(thread.area, candidate.area).count) { score += 12; reasons.push('Area appears compatible'); }
    if (candidate.partial || thread.partial) { score += 4; reasons.push('Can contribute as part of an assembly'); }
    const owner = people.find((person) => person.id === candidate.ownerId);
    return { threadId: candidate.id, score: Math.min(99, Math.max(12, score)), reasons: reasons.length ? reasons : ['Complementary need and offer'], owner: owner?.name || 'Market participant' };
  }).filter((item) => item.score >= 28).sort((a,b) => b.score - a.score).slice(0,6);
}

export function deterministicReview(thread) {
  const issues = [];
  const strengths = [];
  if (thread.title && thread.description?.length > 50) strengths.push('The desired outcome is described in useful detail.');
  if (thread.area) strengths.push('The geographic scope is visible.'); else issues.push({ severity:'medium', title:'Location is unclear', detail:'Add a town, radius, pickup area, delivery range, or remote option.' });
  if (thread.when) strengths.push('Timing expectations are stated.'); else issues.push({ severity:'medium', title:'Timing is open-ended', detail:'Add a deadline, availability window, or “flexible” explicitly.' });
  if (!thread.amount && !(thread.methods || []).some((method) => ['Gift','Barter','Loan','Pay what you can'].includes(method))) issues.push({ severity:'high', title:'Compensation is ambiguous', detail:'State a budget, price, barter request, gift status, or pay-what-you-can range.' });
  if (!thread.quantity) issues.push({ severity:'low', title:'Completion may be hard to measure', detail:'Add a quantity, duration, dimensions, frequency, or definition of done.' });
  if (!thread.methods?.length) issues.push({ severity:'medium', title:'No exchange method selected', detail:'Choose cash, barter, gift, community credit, loan, or pay-what-you-can.' });
  const safety = /(electrical|roof|gas|medical|childcare|structural|wheelchair ramp|firearm|weapon|hazard|chemical|legal|permit)/i.test(`${thread.title} ${thread.description}`);
  if (safety) issues.push({ severity:'high', title:'Safety or regulated work may be involved', detail:'Clarify qualifications, permits, supervision, inspection, insurance, and who carries responsibility.' });
  if (thread.amount && thread.amount < 15 && /(hour|repair|install|design|haul|clean|care)/i.test(`${thread.title} ${thread.description} ${thread.quantity}`)) issues.push({ severity:'medium', title:'Compensation may not reflect the scope', detail:'Confirm time, materials, travel, disposal, and revision costs before agreement.' });
  return { summary: issues.length ? `${issues.length} point${issues.length === 1 ? '' : 's'} to clarify before commitment.` : 'This thread is unusually clear for an early market post.', strengths, issues, nextQuestions: issues.slice(0,4).map((item) => item.detail) };
}

export function deterministicAssembly(thread, matches = [], threads = [], people = []) {
  const selected = matches.slice(0,4).map((match, index) => {
    const candidate = threads.find((item) => item.id === match.threadId);
    const owner = people.find((person) => person.id === candidate?.ownerId);
    return {
      threadId: match.threadId,
      personId: candidate?.ownerId || '',
      label: candidate?.title || `Contribution ${index + 1}`,
      contributor: owner?.name || 'Market participant',
      contribution: candidate?.mode === 'offer' ? candidate.description : `Coordinate around ${candidate?.title || 'this thread'}`,
      value: 1,
      status: 'suggested'
    };
  });
  const gaps = [];
  if (!selected.length) gaps.push('No complementary offers are currently visible in this device’s market data.');
  if (!thread.amount && !(thread.methods || []).includes('Gift')) gaps.push('Compensation or barter terms still need agreement.');
  if (!thread.when) gaps.push('A shared schedule still needs to be chosen.');
  if (!thread.area) gaps.push('Location or delivery boundaries still need to be set.');
  if (/(install|repair|build|electrical|roof|gas|ramp)/i.test(`${thread.title} ${thread.description}`)) gaps.push('A qualified safety or inspection role may be required.');
  return {
    title: `${thread.title} · proposed assembly`,
    outcome: `Fulfill “${thread.title}” through a coordinated set of contributions.`,
    steps: selected.map((item, index) => ({ order:index + 1, label:item.label, owner:item.contributor, dependency:index === 0 ? 'none' : `confirm step ${index}` })),
    contributions: selected,
    gaps,
    confidence: selected.length ? Math.min(92, 52 + selected.length * 10) : 32
  };
}

export function deterministicProposal(thread, profile = {}) {
  const opener = thread.mode === 'need' ? `I may be able to help with ${thread.title.toLowerCase()}.` : `I’m interested in ${thread.title.toLowerCase()}.`;
  const compensation = thread.amount ? `$${Number(thread.amount).toLocaleString('en-US')}${thread.quantity ? ` for ${thread.quantity}` : ''}` : (thread.methods?.includes('Barter') ? 'Open to a clearly defined barter arrangement' : 'Open terms, to confirm together');
  const questions = deterministicReview(thread).issues.slice(0,3).map((item) => item.detail);
  return {
    message: `${opener} I’d like to confirm the exact scope and make sure the arrangement works for both of us.`,
    compensation,
    when: thread.when || 'Flexible, once timing is confirmed',
    conditions: questions.join(' '),
    checklist: ['Confirm scope and definition of done','Confirm compensation and material costs','Confirm timing, location, and cancellation expectations']
  };
}

export function deterministicProviderProfile(text, profile = {}) {
  const draft = deterministicDraft(text, 'offer');
  const skills = tokens(text).slice(0,8);
  return {
    headline: draft.title,
    summary: draft.description,
    category: draft.category,
    suggestedOffers: [
      { title:draft.title, description:draft.description, category:draft.category, methods:draft.methods, amount:draft.amount || '' },
      { title:`Intro session: ${skills.slice(0,3).join(' / ') || 'practical help'}`, description:'A small, clearly bounded first exchange for new neighbors who want to test fit before a larger commitment.', category:draft.category, methods:['Cash','Barter','Pay what you can'], amount:'' }
    ],
    boundaries: ['State what is included and excluded','Set an availability window','Disclose experience level honestly','Name any materials, travel, or safety requirements'],
    intakeQuestions: ['What outcome are you trying to reach?','What deadline and location apply?','What has already been tried?','What budget or exchange terms are workable?']
  };
}

export function deterministicMarketSignals(threads = []) {
  const active = threads.filter((thread) => thread.status !== 'complete');
  const grouped = new Map();
  for (const thread of active) {
    const row = grouped.get(thread.category) || { category:thread.category, needs:0, offers:0, collective:0, examples:[] };
    row[thread.mode === 'need' ? 'needs' : thread.mode === 'offer' ? 'offers' : 'collective'] += 1;
    row.examples.push(thread.title);
    grouped.set(thread.category,row);
  }
  const signals = [...grouped.values()].map((row) => ({
    ...row,
    gap: row.needs - row.offers,
    opportunity: row.needs > row.offers ? `Unmet ${row.category.toLowerCase()} demand` : row.offers > row.needs ? `Available ${row.category.toLowerCase()} capacity` : `Balanced early activity`
  })).sort((a,b) => Math.abs(b.gap) - Math.abs(a.gap));
  const terms = new Map();
  active.filter((thread) => thread.mode !== 'offer').forEach((thread) => tokens(`${thread.title} ${thread.description}`).slice(0,12).forEach((token) => terms.set(token,(terms.get(token)||0)+1)));
  const repeated = [...terms.entries()].filter(([,count]) => count > 1).sort((a,b) => b[1]-a[1]).slice(0,8).map(([term,count]) => ({ term,count }));
  return { signals, repeated, summary: `${active.length} active threads reveal ${signals.filter((row) => row.gap > 0).length} categories with more needs than visible offers.` };
}

function stripFence(text = '') {
  return String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
}

export function parseLooseJSON(value) {
  if (typeof value === 'object' && value !== null) return value;
  const text = stripFence(value);
  try { return JSON.parse(text); } catch {}
  const start = Math.min(...['{','['].map((char) => { const index = text.indexOf(char); return index < 0 ? Infinity : index; }));
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (Number.isFinite(start) && end > start) return JSON.parse(text.slice(start,end+1));
  throw new Error('The model did not return readable JSON.');
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal:controller.signal }); }
  finally { clearTimeout(timer); }
}

async function directOpenAI(settings, system, user) {
  const base = settings.endpoint.replace(/\/$/,'');
  const url = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
  const response = await fetchWithTimeout(url, {
    method:'POST', headers:{ 'content-type':'application/json', ...(settings.apiKey ? { authorization:`Bearer ${settings.apiKey}` } : {}) },
    body:JSON.stringify({ model:settings.model, messages:[{role:'system',content:system},{role:'user',content:user}], temperature:0.2, stream:false })
  }, settings.timeoutMs);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `Provider returned ${response.status}`);
  return payload?.choices?.[0]?.message?.content || '';
}

async function directGemini(settings, system, user) {
  const base = (settings.endpoint || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/,'');
  const model = settings.model || 'gemini-2.5-flash';
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const body = { systemInstruction:{ parts:[{ text:system }] }, contents:[{ role:'user', parts:[{ text:user }] }], generationConfig:{ temperature:0.2, responseMimeType:'application/json' } };
  let response = await fetchWithTimeout(url,{ method:'POST', headers:{'content-type':'application/json','x-goog-api-key':settings.apiKey}, body:JSON.stringify(body) },settings.timeoutMs);
  let payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 400) {
    delete body.generationConfig.responseMimeType;
    response = await fetchWithTimeout(url,{ method:'POST', headers:{'content-type':'application/json','x-goog-api-key':settings.apiKey}, body:JSON.stringify(body) },settings.timeoutMs);
    payload = await response.json().catch(() => ({}));
  }
  if (!response.ok) throw new Error(payload?.error?.message || `Gemini returned ${response.status}`);
  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
}

export async function invokeModel(settingsInput, { task, context, schemaHint }) {
  if (settingsInput?.provider === 'commonweave-shared') {
    const runtime = globalThis.CommonweaveModelRuntime;
    if (!runtime?.generate) throw new Error('The Commonweave model runtime is unavailable.');
    const route = String(settingsInput.route || 'deterministic');
    if (!settingsInput.enabled || route === 'deterministic') throw new Error('DETERMINISTIC_MODE');
    const provider = route === 'local-api'
      ? (/11434|\/api\/chat/i.test(String(settingsInput.endpoint || '')) ? 'ollama' : 'openai-compatible')
      : route === 'gguf' ? 'openai-compatible' : route;
    const system = `You are Rook the Raven, FellowFare's exchange guide. Name the need or offer, ask what matters, show practical paths, call out costs and fairness plainly, recommend the cleanest flight path, and offer the next handoff. Be wry, warm, grounded, and delighted by salvage—never call it junk. No riddles when stakes are real. You are operating through FellowFare Loom, an economic coordination assistant inside Commonweave. Existing constraints remain binding: help people form clear, fair, consent-based exchanges; never publish, accept, spend, commit, rate, reveal private location, or make binding decisions; return JSON only; use concise plain language. ${schemaHint || ''}`;
    const agenticTask = /(?:background|agent|research|search|source|url|web|youtube|market-scan|discovery)/i.test(String(task || ''));
    const runtimeGenerate = agenticTask && runtime.generateAgentic ? runtime.generateAgentic.bind(runtime) : (runtime.generateInteractive || runtime.generate).bind(runtime);
    const result = await runtimeGenerate({
      purpose: String(task || 'fellowfare-loom'),
      executionProfile: agenticTask ? 'agentic' : 'interactive',
      background: agenticTask,
      requiresTools: agenticTask,
      config: {
        provider,
        route,
        model: String(settingsInput.model || ''),
        endpoint: String(settingsInput.endpoint || ''),
        apiKey: String(settingsInput.apiKey || ''),
        externalConsent: Boolean(settingsInput.externalConsent),
        timeoutMs: Number(settingsInput.timeoutMs || 120000),
        temperature: 0.2,
        maxTokens: 4096,
        stream: false,
        service: 'fellowfare'
      },
      messages: [
        { role:'system', content:system },
        { role:'user', content:JSON.stringify({ task, context }) }
      ],
      responseFormat:'json',
      maxRepairAttempts:1,
      requireExternalConsent:false
    });
    if (result?.json && typeof result.json === 'object') return result.json;
    return parseLooseJSON(runtime.resultText?.(result) || result?.text || result?.output || '');
  }
  const settings = normalizeAISettings(settingsInput);
  if (!settings.enabled || settings.provider === 'deterministic') throw new Error('DETERMINISTIC_MODE');
  const system = `You are Rook the Raven, FellowFare's exchange guide. Name the need or offer, ask what matters, show practical paths, call out costs and fairness plainly, recommend the cleanest flight path, and offer the next handoff. Be wry, warm, grounded, and delighted by salvage—never call it junk. No riddles when stakes are real. You are operating through FellowFare Loom. Existing constraints remain binding: help people form clear, fair, consent-based exchanges; never publish, accept, spend, commit, rate, reveal private location, or make binding decisions; return JSON only; use concise plain language. ${schemaHint || ''}`;
  const user = JSON.stringify({ task, context });
  let text = '';
  try {
    const response = await fetchWithTimeout('/api/ai/chat', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ ...settings, system, user }) }, settings.timeoutMs + 5000);
    if (response.ok) {
      const payload = await response.json();
      text = payload.content;
    } else if (![404,405,501].includes(response.status)) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Local AI bridge returned ${response.status}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The local AI bridge timed out.');
    if (!/Failed to fetch|404|405|NetworkError/i.test(error.message)) throw error;
  }
  if (!text) {
    text = settings.provider === 'gemini' ? await directGemini(settings,system,user) : await directOpenAI(settings,system,user);
  }
  return parseLooseJSON(text);
}

export async function testModel(settingsInput) {
  const result = await invokeModel(settingsInput,{ task:'connection_test', context:{ prompt:'Return {"ok":true,"message":"Fellowfare Loom connected"}.' }, schemaHint:'Return exactly an object with boolean ok and string message.' });
  if (!result?.ok) throw new Error(result?.message || 'Provider responded but did not pass the connection test.');
  return result;
}
