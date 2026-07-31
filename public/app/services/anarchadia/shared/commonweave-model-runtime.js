(function installCommonweaveModelRuntime(global) {
  "use strict";

  const VERSION = "1.0.0-rc6-context-switching";
  const RESULT_SCHEMA = "commonweave-model-result-1.0";
  const CAPABILITY_SCHEMA = "commonweave-model-capabilities-1.0";
  const SHARED_MODEL_STORAGE_KEY = "commonweave-shared-model";
  const MODEL_PROFILES_STORAGE_KEY = "commonweave-model-profiles-v1";
  const SESSION_SECRET_STORAGE_KEY = "commonweave-model-secrets-v1";
  const CAPABILITY_STORAGE_KEY = "commonweave-model-capabilities-v1";
  const MAX_RESPONSE_BYTES = 5_000_000;
  const DROP_SCHEMA_KEYS = new Set([
    "$schema", "$id", "$defs", "definitions", "examples", "default",
    "additionalProperties", "patternProperties", "unevaluatedProperties",
    "dependentSchemas", "propertyNames", "contentEncoding", "contentMediaType",
    "minContains", "maxContains", "if", "then", "else", "not",
  ]);
  const GEMINI_DROP_SCHEMA_KEYS = new Set([
    ...DROP_SCHEMA_KEYS, "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
    "minProperties", "maxProperties", "uniqueItems", "contains",
  ]);

  const nowIso = () => new Date().toISOString();
  const uid = (prefix = "model") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const isObject = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const clamp = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  };
  const safeString = (value, maximum = 24000) => String(value == null ? "" : value).slice(0, maximum);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function dispatch(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch {}
  }

  function emit(context, phase, detail = {}) {
    const event = {
      schema: "commonweave-model-event-1.0",
      requestId: context.requestId,
      phase,
      provider: context.config.provider,
      model: context.config.model,
      purpose: context.purpose,
      executionProfile: context.executionProfile,
      at: nowIso(),
      ...detail,
    };
    context.events.push(event);
    try { context.onEvent?.(event); } catch {}
    dispatch("commonweave:model-event", event);
    return event;
  }

  function canonicalProvider(value, endpoint = "") {
    const provider = safeString(value || "deterministic", 80).toLowerCase();
    if (provider === "local-api") {
      return /11434|\/api\/chat(?:$|\?)/i.test(endpoint) ? "ollama" : "openai-compatible";
    }
    if (["openai", "compatible", "gguf", "packaged"].includes(provider)) return "openai-compatible";
    if (provider === "ollama-cloud") return "ollama";
    if (provider === "suite-bridge") return "hosted";
    return provider;
  }

  function normalizeConfig(input = {}) {
    const rawProvider = safeString(input.provider || input.route || input.engine || "deterministic", 80).toLowerCase();
    const endpoint = safeString(input.endpoint || input.baseUrl || "", 2048).trim();
    const provider = canonicalProvider(rawProvider, endpoint);
    const timeoutMs = clamp(input.timeoutMs ?? (Number(input.timeoutSeconds) * 1000), 5000, 600000, 90000);
    return {
      provider,
      requestedProvider: rawProvider,
      model: safeString(input.model || input.modelId || providerDefaultModel(provider), 200).trim(),
      endpoint,
      apiKey: safeString(input.apiKey || input.bearerToken || "", 1000),
      timeoutMs,
      temperature: clamp(input.temperature, 0, 2, 0.2),
      maxTokens: Math.round(clamp(input.maxTokens || input.max_tokens, 1, 131072, 4096)),
      context: Math.round(clamp(input.context || input.numCtx || input.num_ctx, 256, 1048576, 8192)),
      stream: Boolean(input.stream),
      keepAlive: safeString(input.keepAlive || input.keep_alive || "10m", 80),
      headers: isObject(input.headers) ? { ...input.headers } : {},
      externalConsent: Boolean(input.externalConsent || input.remoteConsent),
      service: safeString(input.service || "commonweave", 80),
      localApiFlavor: safeString(input.localApiFlavor || "", 40),
      rawProvider,
    };
  }

  function providerDefaultModel(provider) {
    if (provider === "gemini") return "gemini-3.5-flash-lite";
    if (provider === "deterministic") return "deterministic-compiler";
    if (provider === "browser") return "browser-native";
    if (provider === "manual") return "manual-exchange";
    if (provider === "ollama") return "llama3.2";
    if (provider === "hosted") return "suite-default";
    return "local-model";
  }

  function endpointAddressSpace(value) {
    try {
      const url = new URL(value, global.location?.href || "http://localhost/");
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "::1" || /^127\./.test(host)) return "loopback";
      if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith(".local")) return "local";
      return "public";
    } catch { return "unknown"; }
  }

  function endpointLeavesDevice(configInput) {
    const config = normalizeConfig(configInput);
    if (["hosted", "gemini"].includes(config.provider)) return true;
    if (!config.endpoint || config.endpoint.startsWith("/")) return false;
    return !["loopback", "local"].includes(endpointAddressSpace(config.endpoint));
  }

  function checkedUrl(value, configInput = {}) {
    const config = normalizeConfig(configInput);
    let url;
    try { url = new URL(value, global.location?.href || "http://localhost/"); }
    catch { throw runtimeError("INVALID_ENDPOINT", "The provider endpoint is not a valid URL."); }
    if (!["http:", "https:"].includes(url.protocol)) throw runtimeError("INVALID_ENDPOINT", "Provider endpoints must use HTTP or HTTPS.");
    if (url.username || url.password) throw runtimeError("INVALID_ENDPOINT", "Provider endpoints must not contain embedded credentials.");
    if (config.provider === "gemini") {
      const directGoogle = url.protocol === "https:" && url.hostname === "generativelanguage.googleapis.com";
      const sameOriginProxy = global.location && url.origin === global.location.origin && url.pathname.startsWith("/gemini/");
      if (!directGoogle && !sameOriginProxy) throw runtimeError("UNSAFE_SECRET_DESTINATION", "Gemini API keys may only be sent to Google's HTTPS API host or a same-origin Gemini proxy.");
    }
    return url;
  }

  function runtimeError(code, message, detail = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, detail);
    return error;
  }

  function sanitizeSchema(value, options = {}, depth = 0, counter = { nodes: 0 }) {
    const provider = canonicalProvider(options.provider || "generic", "");
    const drop = provider === "gemini" ? GEMINI_DROP_SCHEMA_KEYS : DROP_SCHEMA_KEYS;
    const maxDepth = Math.max(2, Math.min(24, Number(options.maxDepth || 12)));
    const maxNodes = Math.max(32, Math.min(5000, Number(options.maxNodes || 1200)));
    if (depth > maxDepth || counter.nodes++ > maxNodes) return {};
    if (Array.isArray(value)) return value.slice(0, 256).map(item => sanitizeSchema(item, options, depth + 1, counter));
    if (!isObject(value)) return value;
    const source = value;
    const output = {};
    const union = Array.isArray(source.anyOf) ? source.anyOf : Array.isArray(source.oneOf) ? source.oneOf : null;
    if (union?.length) {
      const chosen = union.find(item => isObject(item) && item.type !== "null") || union[0];
      Object.assign(output, sanitizeSchema(chosen, options, depth + 1, counter));
    }
    for (const [key, child] of Object.entries(source)) {
      if (drop.has(key) || key === "anyOf" || key === "oneOf") continue;
      if (key === "const") { output.enum = [sanitizeSchema(child, options, depth + 1, counter)]; continue; }
      if (key === "type" && Array.isArray(child)) {
        output.type = child.find(type => type !== "null") || child[0];
        continue;
      }
      if (key === "required" && Array.isArray(child)) {
        output.required = child.filter(item => typeof item === "string").slice(0, 256);
        continue;
      }
      if (key === "enum" && Array.isArray(child)) {
        output.enum = child.slice(0, 128).map(item => sanitizeSchema(item, options, depth + 1, counter));
        continue;
      }
      output[key] = sanitizeSchema(child, options, depth + 1, counter);
    }
    return output;
  }

  function validateSchema(value, schema, path = "$", errors = [], depth = 0) {
    if (!schema || !isObject(schema) || depth > 24 || errors.length > 50) return errors;
    if (Array.isArray(schema.enum) && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) {
      errors.push(`${path} must match one of the declared values.`);
      return errors;
    }
    const type = Array.isArray(schema.type) ? schema.type.find(item => item !== "null") : schema.type;
    if (type === "object") {
      if (!isObject(value)) { errors.push(`${path} must be an object.`); return errors; }
      const required = Array.isArray(schema.required) ? schema.required : [];
      for (const key of required) if (!(key in value)) errors.push(`${path}.${key} is required.`);
      const properties = isObject(schema.properties) ? schema.properties : {};
      for (const [key, child] of Object.entries(properties)) if (key in value) validateSchema(value[key], child, `${path}.${key}`, errors, depth + 1);
    } else if (type === "array") {
      if (!Array.isArray(value)) { errors.push(`${path} must be an array.`); return errors; }
      if (Number.isFinite(Number(schema.minItems)) && value.length < Number(schema.minItems)) errors.push(`${path} must contain at least ${schema.minItems} items.`);
      if (Number.isFinite(Number(schema.maxItems)) && value.length > Number(schema.maxItems)) errors.push(`${path} must contain no more than ${schema.maxItems} items.`);
      if (schema.items) value.slice(0, 512).forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`, errors, depth + 1));
    } else if (type === "string" && typeof value !== "string") errors.push(`${path} must be a string.`);
    else if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) errors.push(`${path} must be a number.`);
    else if (type === "integer" && (!Number.isInteger(value))) errors.push(`${path} must be an integer.`);
    else if (type === "boolean" && typeof value !== "boolean") errors.push(`${path} must be a boolean.`);
    return errors;
  }

  function stripCodeFence(text) {
    return safeString(text, MAX_RESPONSE_BYTES).trim().replace(/^```(?:json|javascript|js)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  function firstBalancedJson(text) {
    const source = stripCodeFence(text);
    for (let start = 0; start < source.length; start += 1) {
      const opener = source[start];
      if (opener !== "{" && opener !== "[") continue;
      const closer = opener === "{" ? "}" : "]";
      let depth = 0, quoted = false, escaped = false;
      for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') quoted = false;
          continue;
        }
        if (char === '"') { quoted = true; continue; }
        if (char === opener) depth += 1;
        else if (char === closer) {
          depth -= 1;
          if (depth === 0) return source.slice(start, index + 1);
        }
      }
    }
    return source;
  }

  function parseJsonLoose(text) {
    const cleaned = firstBalancedJson(text);
    try { return JSON.parse(cleaned); }
    catch (error) { throw runtimeError("INVALID_JSON", "The provider did not return valid JSON.", { cause: error, recoverableText: cleaned.slice(0, 12000) }); }
  }

  function extractText(payload) {
    if (typeof payload === "string") return payload;
    if (!payload || typeof payload !== "object") return "";
    for (const key of ["text", "output_text", "output", "response", "content", "message"]) {
      if (typeof payload[key] === "string") return payload[key];
    }
    for (const key of ["data", "result"]) {
      if (payload[key] && typeof payload[key] === "object") {
        const nested = extractText(payload[key]);
        if (nested) return nested;
      }
    }
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    if (choices[0]) {
      const content = choices[0]?.message?.content ?? choices[0]?.delta?.content ?? choices[0]?.text;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) return content.map(item => item?.text || item?.content || "").join("");
    }
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    return (candidates[0]?.content?.parts || []).map(part => part?.text || "").join("");
  }

  function extractUsage(payload) {
    const usage = isObject(payload?.usage) ? payload.usage : isObject(payload?.usageMetadata) ? payload.usageMetadata : {};
    return {
      inputTokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? usage.inputTokens ?? 0) || 0,
      outputTokens: Number(usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? usage.outputTokens ?? 0) || 0,
      totalTokens: Number(usage.total_tokens ?? usage.totalTokenCount ?? usage.totalTokens ?? 0) || 0,
      costCents: Number(usage.costCents ?? payload?.costCents ?? 0) || 0,
      remainingCents: Number(usage.remainingCents ?? payload?.remainingCents ?? 0) || 0,
    };
  }

  async function readBoundedText(response, maximum = MAX_RESPONSE_BYTES) {
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (Number.isFinite(declared) && declared > maximum) throw runtimeError("RESPONSE_TOO_LARGE", "The provider response exceeded the size limit.");
    if (!response.body?.getReader) {
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maximum) throw runtimeError("RESPONSE_TOO_LARGE", "The provider response exceeded the size limit.");
      return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maximum) { await reader.cancel(); throw runtimeError("RESPONSE_TOO_LARGE", "The provider response exceeded the size limit."); }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } finally { reader.releaseLock(); }
  }

  function fetchOptions(url, init = {}) {
    const options = { cache: "no-store", redirect: "error", credentials: "omit", ...init };
    const space = endpointAddressSpace(url);
    if (["loopback", "local"].includes(space)) options.targetAddressSpace = "local";
    return options;
  }

  function makeController(externalSignal, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(externalSignal?.reason || new DOMException("Generation cancelled", "AbortError"));
    externalSignal?.addEventListener?.("abort", onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException("Generation timed out", "TimeoutError"));
    }, timeoutMs);
    return {
      signal: controller.signal,
      timedOut: () => timedOut,
      cleanup() { clearTimeout(timer); externalSignal?.removeEventListener?.("abort", onAbort); },
    };
  }

  function messagesFromRequest(request) {
    if (Array.isArray(request.messages)) {
      return request.messages.map(item => ({
        role: item?.role === "assistant" ? "assistant" : item?.role === "system" ? "system" : "user",
        content: safeString(item?.content, 48000),
      })).filter(item => item.content);
    }
    const messages = [];
    if (request.system) messages.push({ role: "system", content: safeString(request.system, 48000) });
    if (request.prompt) messages.push({ role: "user", content: safeString(request.prompt, 48000) });
    return messages.length ? messages : [{ role: "user", content: "Continue." }];
  }

  function normalizeChatMessages(messages, foldSystem = false) {
    const system = [];
    const conversation = [];
    for (const item of messages) {
      const role = item.role === "assistant" ? "assistant" : item.role === "system" ? "system" : "user";
      const content = safeString(item.content, 48000).trim();
      if (!content) continue;
      if (role === "system") { system.push(content); continue; }
      const previous = conversation[conversation.length - 1];
      if (previous?.role === role) previous.content += `\n\n${content}`;
      else conversation.push({ role, content });
    }
    while (conversation[0]?.role === "assistant") system.push(`Earlier assistant context:\n${conversation.shift().content}`);
    if (!conversation.length) conversation.push({ role: "user", content: "Continue." });
    if (conversation.at(-1)?.role === "assistant") conversation.push({ role: "user", content: "Continue from the preceding context." });
    const systemText = system.join("\n\n");
    if (foldSystem && systemText) conversation[0].content = `System instructions:\n${systemText}\n\nUser request:\n${conversation[0].content}`;
    else if (systemText) conversation.unshift({ role: "system", content: systemText });
    return conversation;
  }

  async function parseOpenAIStream(response, context) {
    if (!response.body?.getReader) return readBoundedText(response);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", output = "", bytes = 0, usage = {};
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw runtimeError("RESPONSE_TOO_LARGE", "The provider response exceeded the size limit.");
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let payload; try { payload = JSON.parse(data); } catch { continue; }
          const delta = extractText(payload);
          if (delta) { output += delta; emit(context, "partial", { text: delta, accumulatedText: output }); }
          if (payload.usage) usage = extractUsage(payload);
        }
      }
      return { text: output, usage, payload: { text: output, usage } };
    } finally { reader.releaseLock(); }
  }

  async function parseOllamaStream(response, context) {
    if (!response.body?.getReader) return { text: await readBoundedText(response), payload: {} };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", output = "", bytes = 0, last = {};
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw runtimeError("RESPONSE_TOO_LARGE", "The provider response exceeded the size limit.");
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/); buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let payload; try { payload = JSON.parse(line); } catch { continue; }
          last = payload;
          const delta = payload.message?.content ?? payload.response ?? "";
          if (delta) { output += delta; emit(context, "partial", { text: delta, accumulatedText: output }); }
        }
      }
      return { text: output, usage: extractUsage(last), payload: last };
    } finally { reader.releaseLock(); }
  }

  async function parseGeminiSse(response, context) {
    const parsed = await parseOpenAIStream(response, {
      ...context,
      onEvent(event) { context.onEvent?.(event); },
    });
    if (parsed.text) return parsed;
    const text = await readBoundedText(response);
    const pieces = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim().startsWith("data:")) continue;
      try { pieces.push(extractText(JSON.parse(line.trim().slice(5).trim()))); } catch {}
    }
    const output = pieces.join("");
    if (output) emit(context, "partial", { text: output, accumulatedText: output });
    return { text: output, payload: { text: output } };
  }

  async function invokeHosted(config, messages, request, context, signal) {
    const endpoint = checkedUrl(config.endpoint || "/api/ai", config).href;
    emit(context, "connecting", { endpoint: redactUrl(endpoint) });
    const response = await fetch(endpoint, fetchOptions(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...config.headers },
      body: JSON.stringify({
        schema: "commonweave-model-request-1.0",
        service: config.service,
        purpose: context.purpose,
        model: config.model,
        messages,
        system: messages.filter(item => item.role === "system").map(item => item.content).join("\n\n"),
        prompt: messages.filter(item => item.role !== "system").at(-1)?.content || "",
        responseFormat: request.responseFormat || (request.schema ? "json" : "text"),
        responseSchema: request.schema ? sanitizeSchema(request.schema, { provider: "generic" }) : undefined,
        stream: false,
      }),
      signal,
    }));
    const text = await readBoundedText(response);
    let payload; try { payload = JSON.parse(text || "{}"); } catch { payload = { text }; }
    if (!response.ok || payload?.ok === false) throw providerHttpError("Hosted AI", response.status, payload?.error?.message || payload?.error || text);
    return { text: extractText(payload), payload, usage: extractUsage(payload), model: payload.model || config.model, streamed: false };
  }

  function isAntigravityModel(model) {
    const value = safeString(model, 200).trim().toLowerCase();
    return value === "antigravity" || value.startsWith("antigravity-");
  }

  async function invokeAntigravity(config, messages, request, context, signal) {
    if (!config.apiKey) throw runtimeError("MISSING_API_KEY", "A session-only Gemini API key is required.");
    const base = checkedUrl(config.endpoint || "https://generativelanguage.googleapis.com/v1beta", config).href.replace(/\/+$/, "");
    const directUrl = `${base}/interactions`;
    let connectedHost = "";
    try { connectedHost = JSON.parse(global.localStorage?.getItem?.("commonweave.host-node.v1") || "null")?.baseUrl || ""; } catch {}
    const hostedAtNode = Boolean(global.location && /^https?:$/.test(global.location.protocol) && global.location.pathname.startsWith("/app/"));
    const proxyBase = safeString(connectedHost || (hostedAtNode ? global.location.origin : ""), 2048).replace(/\/+$/, "");
    const canUseHostProxy = Boolean(proxyBase);
    const url = canUseHostProxy ? `${proxyBase}/api/ai/gemini/interactions` : directUrl;
    const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
    const conversation = messages.filter(item => item.role !== "system").map(item => `${item.role === "assistant" ? "Assistant" : "User"}: ${item.content}`).join("\n\n");
    const structured = request.responseFormat === "json" || Boolean(request.schema);
    const input = `${conversation || "Continue."}${structured ? "\n\nReturn the final answer as valid JSON only, matching the requested contract." : ""}`;
    const body = {
      agent: config.model === "antigravity" ? "antigravity-preview-05-2026" : config.model,
      input,
      environment: "remote",
      background: true,
      ...(system ? { system_instruction: system } : {}),
      agent_config: { type: "antigravity", max_total_tokens: String(Math.max(config.maxTokens, 8192)) },
    };
    const headers = { "content-type": "application/json", "x-goog-api-key": config.apiKey, "Api-Revision": "2026-05-20", ...config.headers };
    emit(context, "connecting", { endpoint: redactUrl(url), agent: body.agent, background: true, transport: canUseHostProxy ? "host-node-proxy" : "direct", tools: ["code_execution", "google_search", "url_context"] });
    let response = await fetch(url, fetchOptions(url, { method: "POST", headers, body: JSON.stringify(body), signal }));
    if (!response.ok) throw providerHttpError("Antigravity", response.status, await readBoundedText(response).catch(() => ""));
    let payload = JSON.parse(await readBoundedText(response) || "{}");
    const interactionId = payload.id;
    if (!interactionId) throw runtimeError("INVALID_PROVIDER_JSON", "Antigravity did not return an interaction ID.");
    try {
      const pending = JSON.parse(global.localStorage?.getItem?.("commonweave-antigravity-pending-v1") || "{}");
      pending[context.requestId] = { interactionId, purpose: context.purpose, startedAt: nowIso() };
      global.localStorage?.setItem?.("commonweave-antigravity-pending-v1", JSON.stringify(pending));
    } catch {}
    emit(context, "background", { interactionId, status: payload.status || "in_progress" });
    while (["in_progress", "queued", "running"].includes(String(payload.status || "in_progress").toLowerCase())) {
      await sleep(3000);
      response = await fetch(`${url}/${encodeURIComponent(interactionId)}`, fetchOptions(url, { headers: { "x-goog-api-key": config.apiKey, ...config.headers }, signal }));
      if (!response.ok) throw providerHttpError("Antigravity", response.status, await readBoundedText(response).catch(() => ""));
      payload = JSON.parse(await readBoundedText(response) || "{}");
      emit(context, "background", { interactionId, status: payload.status || "in_progress" });
    }
    try {
      const pending = JSON.parse(global.localStorage?.getItem?.("commonweave-antigravity-pending-v1") || "{}");
      delete pending[context.requestId];
      global.localStorage?.setItem?.("commonweave-antigravity-pending-v1", JSON.stringify(pending));
    } catch {}
    if (!["completed", "succeeded"].includes(String(payload.status || "completed").toLowerCase())) throw runtimeError("AGENT_FAILED", `Antigravity ended with status ${payload.status || "unknown"}.`, { payload });
    return { text: extractText(payload), payload, usage: extractUsage(payload), model: body.agent, streamed: false, diagnostics: ["Managed Antigravity agent used remote code execution, Google Search, and URL Context in a Google-hosted sandbox."] };
  }

  async function invokeGemini(config, messages, request, context, signal) {
    if (isAntigravityModel(config.model)) return invokeAntigravity(config, messages, request, context, signal);
    if (!config.apiKey) throw runtimeError("MISSING_API_KEY", "A session-only Gemini API key is required.");
    const base = checkedUrl(config.endpoint || "https://generativelanguage.googleapis.com/v1beta", config).href.replace(/\/+$/, "");
    const system = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
    const contents = messages.filter(item => item.role !== "system").map(item => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.content }] }));
    const schema = request.schema ? sanitizeSchema(request.schema, { provider: "gemini" }) : null;
    const structured = request.responseFormat === "json" || Boolean(schema);
    const useStream = Boolean(config.stream && !structured);
    const method = useStream ? "streamGenerateContent" : "generateContent";
    const requestUrl = `${base}/models/${encodeURIComponent(config.model)}:${method}${useStream ? "?alt=sse" : ""}`;
    const body = {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        ...(structured ? { responseMimeType: "application/json" } : {}),
        ...(schema ? { responseJsonSchema: schema } : {}),
      },
    };
    emit(context, "connecting", { endpoint: redactUrl(requestUrl), structured, streamed: useStream });
    const headers = { "content-type": "application/json", "x-goog-api-key": config.apiKey, ...config.headers };
    let response = await fetch(requestUrl, fetchOptions(requestUrl, { method: "POST", headers, body: JSON.stringify(body), signal }));
    let schemaRetry = false;
    if (!response.ok && response.status === 400 && schema) {
      const initial = await readBoundedText(response).catch(() => "");
      schemaRetry = true;
      emit(context, "repairing", { reason: "provider-schema-rejection", detail: safeString(initial, 800) });
      delete body.generationConfig.responseJsonSchema;
      response = await fetch(requestUrl, fetchOptions(requestUrl, { method: "POST", headers, body: JSON.stringify(body), signal }));
    }
    if (!response.ok) throw providerHttpError("Gemini", response.status, await readBoundedText(response).catch(() => ""));
    if (useStream) {
      const streamed = await parseGeminiSse(response, context);
      return { ...streamed, model: config.model, streamed: true, diagnostics: schemaRetry ? ["Gemini rejected the response schema; JSON mode succeeded without the attached schema."] : [] };
    }
    const responseText = await readBoundedText(response);
    let payload; try { payload = JSON.parse(responseText || "{}"); } catch { throw runtimeError("INVALID_PROVIDER_JSON", "Gemini returned invalid transport JSON.", { recoverableText: responseText.slice(0, 12000) }); }
    const blockReason = payload?.promptFeedback?.blockReason;
    const text = extractText(payload);
    if (!text && blockReason) throw runtimeError("PROVIDER_BLOCKED", `Gemini blocked the request: ${blockReason}`);
    return { text, payload, usage: extractUsage(payload), model: config.model, streamed: false, diagnostics: schemaRetry ? ["Gemini rejected the response schema; JSON mode succeeded without the attached schema."] : [] };
  }

  async function invokeOllama(config, messages, request, context, signal) {
    let endpoint = config.endpoint || "http://127.0.0.1:11434/api/chat";
    if (!/\/api\/(chat|generate)(?:$|\?)/.test(endpoint)) endpoint = `${endpoint.replace(/\/+$/, "")}/api/chat`;
    const url = checkedUrl(endpoint, config).href;
    const structured = request.responseFormat === "json" || Boolean(request.schema);
    const useStream = Boolean(config.stream);
    emit(context, "connecting", { endpoint: redactUrl(url), structured, streamed: useStream });
    const response = await fetch(url, fetchOptions(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}), ...config.headers },
      body: JSON.stringify({
        model: config.model,
        messages: normalizeChatMessages(messages),
        stream: useStream,
        ...(structured ? { format: request.schema ? sanitizeSchema(request.schema, { provider: "generic" }) : "json" } : {}),
        keep_alive: config.keepAlive,
        options: { temperature: config.temperature, num_ctx: config.context },
      }),
      signal,
    }));
    if (!response.ok) throw providerHttpError("Ollama", response.status, await readBoundedText(response).catch(() => ""));
    if (useStream) return { ...(await parseOllamaStream(response, context)), model: config.model, streamed: true };
    const text = await readBoundedText(response);
    let payload; try { payload = JSON.parse(text || "{}"); } catch { throw runtimeError("INVALID_PROVIDER_JSON", "Ollama returned invalid transport JSON.", { recoverableText: text.slice(0, 12000) }); }
    return { text: extractText(payload), payload, usage: extractUsage(payload), model: payload.model || config.model, streamed: false };
  }

  function openAIChatUrl(endpoint, config) {
    const base = checkedUrl(endpoint || "http://127.0.0.1:8080/v1/chat/completions", config);
    const path = base.pathname.replace(/\/+$/, "");
    if (path.endsWith("/chat/completions")) return base.href;
    base.pathname = path.endsWith("/v1") ? `${path}/chat/completions` : `${path}/v1/chat/completions`;
    return base.href;
  }

  async function invokeOpenAI(config, messages, request, context, signal) {
    const url = openAIChatUrl(config.endpoint, config);
    const structured = request.responseFormat === "json" || Boolean(request.schema);
    const useStream = Boolean(config.stream);
    emit(context, "connecting", { endpoint: redactUrl(url), structured, streamed: useStream });
    const body = {
      model: config.model,
      messages: normalizeChatMessages(messages),
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: useStream,
      ...(useStream ? { stream_options: { include_usage: true } } : {}),
      ...(structured ? { response_format: { type: "json_object" } } : {}),
    };
    let response = await fetch(url, fetchOptions(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}), ...config.headers },
      body: JSON.stringify(body),
      signal,
    }));
    if (!response.ok && structured && [400, 422].includes(response.status)) {
      const first = await readBoundedText(response).catch(() => "");
      emit(context, "repairing", { reason: "provider-response-format-rejection", detail: safeString(first, 800) });
      delete body.response_format;
      response = await fetch(url, fetchOptions(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}), ...config.headers },
        body: JSON.stringify(body),
        signal,
      }));
    }
    if (!response.ok) throw providerHttpError("OpenAI-compatible provider", response.status, await readBoundedText(response).catch(() => ""));
    if (useStream) return { ...(await parseOpenAIStream(response, context)), model: config.model, streamed: true };
    const text = await readBoundedText(response);
    let payload; try { payload = JSON.parse(text || "{}"); } catch { throw runtimeError("INVALID_PROVIDER_JSON", "The OpenAI-compatible endpoint returned invalid transport JSON.", { recoverableText: text.slice(0, 12000) }); }
    return { text: extractText(payload), payload, usage: extractUsage(payload), model: payload.model || config.model, streamed: false };
  }

  async function invokeBrowser(config, messages, request, context, signal) {
    const api = global.LanguageModel || global.ai?.languageModel;
    if (!api?.create) throw runtimeError("BROWSER_MODEL_UNAVAILABLE", "This browser does not expose a LanguageModel API.");
    emit(context, "connecting", { endpoint: "browser-native" });
    const session = await api.create({ temperature: config.temperature, topK: 8, expectedInputs: [{ type: "text" }], expectedOutputs: [{ type: "text" }] });
    const prompt = normalizeChatMessages(messages, true).map(item => `${item.role.toUpperCase()}:\n${item.content}`).join("\n\n");
    signal.addEventListener("abort", () => { try { session.destroy?.(); } catch {} }, { once: true });
    if (config.stream && session.promptStreaming) {
      let text = "";
      for await (const chunk of await session.promptStreaming(prompt)) {
        if (signal.aborted) throw new DOMException("Generation cancelled", "AbortError");
        const delta = safeString(chunk, 48000);
        text += delta;
        emit(context, "partial", { text: delta, accumulatedText: text });
      }
      return { text, payload: { text }, model: config.model, streamed: true };
    }
    const text = await session.prompt(prompt);
    return { text: safeString(text, MAX_RESPONSE_BYTES), payload: { text }, model: config.model, streamed: false };
  }

  function providerHttpError(provider, status, detail) {
    const cleaned = safeString(detail, 2400).replace(/\s+/g, " ").trim();
    return runtimeError("PROVIDER_HTTP_ERROR", `${provider} returned HTTP ${status}${cleaned ? `: ${cleaned}` : ""}`, { status });
  }

  function redactUrl(value) {
    try {
      const url = new URL(value, global.location?.href || "http://localhost/");
      url.username = ""; url.password = ""; url.search = ""; url.hash = "";
      return url.href;
    } catch { return "invalid-endpoint"; }
  }

  async function invokeAdapter(config, messages, request, context, signal) {
    emit(context, "generating", { structured: request.responseFormat === "json" || Boolean(request.schema), streamed: config.stream });
    if (typeof request.transport === "function") {
      const value = await request.transport({ config, messages, purpose: context.purpose, schema: request.schema || null, signal, emit: (phase, detail) => emit(context, phase, detail) });
      if (typeof value === "string") return { text: value, payload: { text: value }, model: config.model, streamed: false };
      return {
        text: extractText(value?.payload ?? value?.text ?? value),
        payload: value?.payload ?? value,
        usage: value?.usage || extractUsage(value?.payload || value),
        model: value?.model || config.model,
        provider: value?.provider,
        streamed: Boolean(value?.streamed),
        diagnostics: Array.isArray(value?.diagnostics) ? value.diagnostics : [],
      };
    }
    if (config.provider === "hosted") return invokeHosted(config, messages, request, context, signal);
    if (config.provider === "gemini") return invokeGemini(config, messages, request, context, signal);
    if (config.provider === "ollama") return invokeOllama(config, messages, request, context, signal);
    if (config.provider === "openai-compatible") return invokeOpenAI(config, messages, request, context, signal);
    if (config.provider === "browser") return invokeBrowser(config, messages, request, context, signal);
    throw runtimeError("UNSUPPORTED_PROVIDER", `The shared runtime does not recognize provider '${config.provider}'.`);
  }

  function repairMessages(messages, rawText, errors) {
    return [
      ...messages,
      { role: "assistant", content: safeString(rawText, 24000) },
      { role: "user", content: `The preceding response was not valid for the required JSON contract. Return only corrected JSON, without markdown or commentary. Validation issues:\n- ${errors.slice(0, 12).join("\n- ")}` },
    ];
  }

  function baseResult(context, config, elapsedMs) {
    return {
      schema: RESULT_SCHEMA,
      requestId: context.requestId,
      purpose: context.purpose,
      requested: { provider: config.requestedProvider, model: config.model, endpoint: redactUrl(config.endpoint || ""), executionProfile: context.executionProfile },
      actual: { provider: config.provider, model: config.model },
      timing: { startedAt: context.startedAt, completedAt: nowIso(), elapsedMs },
      events: context.events,
      diagnostics: [],
    };
  }

  async function generate(request = {}) {
    const executionProfile = resolveExecutionProfile(request);
    const selectedShared = readSharedConfig(executionProfile) || readSharedConfig("interactive") || {};
    const requestedConfig = request.config || {};
    const profileOverride = executionProfile === "agentic" && readSharedConfig("agentic")
      ? { ...requestedConfig, ...selectedShared, apiKey: requestedConfig.apiKey || selectedShared.apiKey, externalConsent: requestedConfig.externalConsent ?? selectedShared.externalConsent }
      : requestedConfig;
    const config = normalizeConfig({ ...selectedShared, ...profileOverride });
    if (endpointLeavesDevice(config) && !config.externalConsent && request.requireExternalConsent !== false) {
      return failureResult("provider-error", runtimeError("REMOTE_CONSENT_REQUIRED", "External provider use requires explicit session consent."), { request, config, context: makeContext(request, config), elapsedMs: 0 });
    }
    const context = makeContext(request, config);
    const started = Date.now();
    const messages = messagesFromRequest(request);
    const structured = request.responseFormat === "json" || Boolean(request.schema);

    if (config.provider === "deterministic") {
      if (typeof request.deterministic !== "function") return failureResult("provider-error", runtimeError("DETERMINISTIC_HANDLER_REQUIRED", "The deterministic route requires an application-supplied local compiler."), { request, config, context, elapsedMs: Date.now() - started });
      try {
        emit(context, "generating", { deterministic: true });
        const output = await request.deterministic({ messages, purpose: context.purpose });
        const text = typeof output === "string" ? output : JSON.stringify(output);
        const result = { ...baseResult(context, config, Date.now() - started), status: "success", outputText: text, outputJson: typeof output === "string" ? undefined : output, usage: {}, stream: { requested: false, used: false }, structured: { requested: structured, valid: true, repairAttempts: 0 }, fallback: { used: false }, actual: { provider: "deterministic", model: config.model } };
        emit(context, "completed", { status: result.status });
        return result;
      } catch (error) { return failureResult("provider-error", error, { request, config, context, elapsedMs: Date.now() - started }); }
    }

    if (config.provider === "manual") {
      const prompt = messages.map(item => `${item.role.toUpperCase()}:\n${item.content}`).join("\n\n");
      try { global.sessionStorage?.setItem?.(`commonweave-manual-${context.purpose}`, prompt); } catch {}
      const result = { ...baseResult(context, config, Date.now() - started), status: "manual-required", manualPrompt: prompt, outputText: "", usage: {}, stream: { requested: false, used: false }, structured: { requested: structured, valid: false, repairAttempts: 0 }, fallback: { used: false } };
      emit(context, "completed", { status: result.status });
      return result;
    }

    const controller = makeController(request.signal, config.timeoutMs);
    let raw;
    let repairAttempts = 0;
    let validationErrors = [];
    try {
      raw = await invokeAdapter(config, messages, request, context, controller.signal);
      let outputText = safeString(raw.text, MAX_RESPONSE_BYTES);
      let outputJson;
      if (structured) {
        emit(context, "validating", {});
        try {
          outputJson = parseJsonLoose(outputText);
          validationErrors = request.schema ? validateSchema(outputJson, request.schema) : [];
        } catch (error) {
          validationErrors = [error.message || "Invalid JSON."];
        }
        const maxRepairAttempts = Math.max(0, Math.min(2, Number(request.maxRepairAttempts ?? 1)));
        while (validationErrors.length && repairAttempts < maxRepairAttempts) {
          repairAttempts += 1;
          emit(context, "repairing", { attempt: repairAttempts, validationErrors: validationErrors.slice(0, 12) });
          const repaired = await invokeAdapter({ ...config, stream: false }, repairMessages(messages, outputText, validationErrors), { ...request, maxRepairAttempts: 0 }, context, controller.signal);
          outputText = safeString(repaired.text, MAX_RESPONSE_BYTES);
          raw = { ...raw, ...repaired, diagnostics: [...(raw.diagnostics || []), ...(repaired.diagnostics || [])] };
          try {
            outputJson = parseJsonLoose(outputText);
            validationErrors = request.schema ? validateSchema(outputJson, request.schema) : [];
          } catch (error) { validationErrors = [error.message || "Invalid JSON."]; }
        }
        if (validationErrors.length) {
          const result = { ...baseResult(context, config, Date.now() - started), status: "invalid-response", outputText, recoverablePayload: outputJson, usage: raw.usage || {}, stream: { requested: config.stream, used: Boolean(raw.streamed) }, structured: { requested: true, valid: false, repairAttempts, errors: validationErrors.slice(0, 24) }, fallback: { used: false }, diagnostics: raw.diagnostics || [], error: { code: "INVALID_STRUCTURED_OUTPUT", message: "The provider response did not satisfy the requested JSON contract." } };
          emit(context, "failed", { status: result.status, error: result.error, validationErrors: result.structured.errors });
          return result;
        }
      }
      const result = { ...baseResult(context, config, Date.now() - started), status: "success", outputText, outputJson, usage: raw.usage || {}, stream: { requested: config.stream, used: Boolean(raw.streamed) }, structured: { requested: structured, valid: true, repairAttempts }, fallback: { used: false }, diagnostics: raw.diagnostics || [], actual: { provider: raw.provider || config.provider, model: raw.model || config.model } };
      emit(context, "completed", { status: result.status, usage: result.usage, streamed: result.stream.used });
      return result;
    } catch (error) {
      if (typeof request.fallback === "function" && !controller.signal.aborted) {
        try {
          emit(context, "repairing", { reason: "deterministic-fallback", error: safeString(error?.message, 1200) });
          const output = await request.fallback({ error, messages, purpose: context.purpose });
          const outputText = typeof output === "string" ? output : JSON.stringify(output);
          const result = { ...baseResult(context, config, Date.now() - started), status: "fallback", outputText, outputJson: typeof output === "string" ? undefined : output, usage: {}, stream: { requested: config.stream, used: false }, structured: { requested: structured, valid: true, repairAttempts }, fallback: { used: true, provider: "deterministic", reason: safeString(error?.message || "Provider unavailable", 1200) }, diagnostics: [] };
          emit(context, "completed", { status: result.status, fallback: result.fallback });
          return result;
        } catch (fallbackError) { error.fallbackError = fallbackError; }
      }
      const externallyCancelled = Boolean(request.signal?.aborted);
      const timedOut = controller.timedOut();
      return failureResult(externallyCancelled ? "cancelled" : timedOut ? "timeout" : "provider-error", error, { request, config, context, elapsedMs: Date.now() - started });
    } finally { controller.cleanup(); }
  }

  function makeContext(request, config) {
    return { requestId: safeString(request.requestId || uid("model"), 160), purpose: safeString(request.purpose || "generation", 120), executionProfile: resolveExecutionProfile(request), startedAt: nowIso(), config, events: [], onEvent: request.onEvent };
  }

  function resolveExecutionProfile(request = {}) {
    const explicit = safeString(request.executionProfile || request.modelRole || request.executionClass || "", 40).toLowerCase();
    if (["agentic", "background", "research", "tool"].includes(explicit)) return "agentic";
    if (["interactive", "creative", "foreground", "generation"].includes(explicit)) return "interactive";
    if (request.background === true || request.agentic === true || request.requiresTools === true || request.webSearch === true || request.youtubeSearch === true) return "agentic";
    const purpose = safeString(request.purpose || "", 160).toLowerCase();
    const agenticPattern = /(web[- ]?search|internet[- ]?search|youtube|video[- ]?search|source[- ]?discovery|url[- ]?context|background[- ]?research|agentic|deep[- ]?research|browse[- ]?web|find[- ]?sources|embed[- ]?video)/;
    return agenticPattern.test(purpose) ? "agentic" : "interactive";
  }

  function failureResult(status, error, { config, context, elapsedMs }) {
    const code = status === "timeout" ? "TIMEOUT" : status === "cancelled" ? "CANCELLED" : safeString(error?.code || "PROVIDER_ERROR", 120);
    const message = safeString(error?.message || "The provider did not complete the request.", 2400);
    const result = { ...baseResult(context, config, elapsedMs), status, outputText: "", usage: {}, stream: { requested: config.stream, used: false }, structured: { requested: false, valid: false, repairAttempts: 0 }, fallback: { used: false }, error: { code, message, status: error?.status, diagnostic: sanitizeDiagnostic(error?.diagnostic) } };
    emit(context, status === "cancelled" ? "cancelled" : "failed", { status, error: result.error });
    return result;
  }

  function sanitizeDiagnostic(value, depth = 0) {
    if (depth > 4) return "[truncated]";
    if (Array.isArray(value)) return value.slice(0, 40).map(item => sanitizeDiagnostic(item, depth + 1));
    if (!isObject(value)) return typeof value === "string" ? safeString(value, 2000) : value;
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (/key|secret|token|authorization|password/i.test(key)) continue;
      output[key] = sanitizeDiagnostic(child, depth + 1);
    }
    return output;
  }

  function resultText(result) {
    if (["success", "fallback"].includes(result?.status)) return result.outputText || "";
    if (result?.status === "manual-required") throw runtimeError("MANUAL_REQUIRED", "Manual exchange prepared the prompt. Paste the model response back into the application.", { result });
    throw runtimeError(result?.error?.code || "MODEL_REQUEST_FAILED", result?.error?.message || `Model request ended with status ${result?.status || "unknown"}.`, { result });
  }

  function resultLabel(result) {
    if (!result) return "Model unavailable";
    if (result.status === "success") return `${result.actual?.provider || "provider"}${result.actual?.model ? ` · ${result.actual.model}` : ""}`;
    if (result.status === "fallback") return `Deterministic fallback · requested ${result.requested?.provider || "provider"}`;
    if (result.status === "timeout") return `${result.requested?.provider || "provider"} timeout`;
    if (result.status === "invalid-response") return `${result.requested?.provider || "provider"} returned invalid structured output`;
    if (result.status === "manual-required") return "Manual exchange prepared";
    if (result.status === "cancelled") return "Generation cancelled";
    return `${result.requested?.provider || "provider"} provider error`;
  }

  function readJsonStorage(storage, key, fallback = null) {
    try { const value = JSON.parse(storage?.getItem?.(key) || "null"); return value ?? fallback; }
    catch { return fallback; }
  }

  function readModelProfiles() {
    const stored = readJsonStorage(global.localStorage, MODEL_PROFILES_STORAGE_KEY, null);
    if (stored?.interactive || stored?.agentic) return stored;
    const legacy = readJsonStorage(global.localStorage, SHARED_MODEL_STORAGE_KEY, null);
    const model = legacy?.model || legacy?.config || legacy;
    return model && isObject(model) ? { interactive: model, agentic: null, agenticEnabled: false } : { interactive: null, agentic: null, agenticEnabled: false };
  }

  function readSharedConfig(profile = "interactive") {
    const profiles = readModelProfiles();
    const selected = profile === "agentic" && profiles.agenticEnabled && profiles.agentic ? profiles.agentic : profiles.interactive;
    if (!selected || !isObject(selected)) return null;
    const session = readJsonStorage(global.sessionStorage, "commonweave-model-session", {});
    const secrets = readJsonStorage(global.sessionStorage, SESSION_SECRET_STORAGE_KEY, {});
    const fingerprint = configFingerprint(selected);
    return normalizeConfig({
      ...selected,
      apiKey: secrets?.[fingerprint]?.apiKey || session?.apiKey || "",
      externalConsent: Boolean(secrets?.[fingerprint]?.externalConsent ?? session?.remoteConsent),
    });
  }

  function saveSharedConfig(input, options = {}) {
    const config = normalizeConfig(input);
    const profile = options.profile === "agentic" || input.profile === "agentic" ? "agentic" : "interactive";
    const safe = { route: input.route || input.provider || config.requestedProvider, provider: config.provider, model: config.model, endpoint: config.endpoint };
    const profiles = readModelProfiles();
    profiles[profile] = safe;
    if (profile === "agentic") profiles.agenticEnabled = options.enabled ?? input.enabled ?? true;
    profiles.savedAt = nowIso(); profiles.runtimeVersion = VERSION;
    global.localStorage?.setItem?.(MODEL_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    if (profile === "interactive") global.localStorage?.setItem?.(SHARED_MODEL_STORAGE_KEY, JSON.stringify({ model: safe, savedAt: nowIso(), runtimeVersion: VERSION }));
    if (config.apiKey || config.externalConsent) saveSessionSecret(config, { apiKey: config.apiKey, externalConsent: config.externalConsent });
    dispatch("commonweave:model-config-changed", { config: safe, profile, profiles, at: nowIso() });
    return safe;
  }

  function saveModelProfiles(input = {}) {
    const profiles = readModelProfiles();
    if (input.interactive) saveSharedConfig(input.interactive, { profile: "interactive" });
    if (input.agentic) saveSharedConfig(input.agentic, { profile: "agentic", enabled: input.agenticEnabled !== false });
    else if ("agenticEnabled" in input) { profiles.agenticEnabled = Boolean(input.agenticEnabled); global.localStorage?.setItem?.(MODEL_PROFILES_STORAGE_KEY, JSON.stringify(profiles)); }
    return readModelProfiles();
  }

  function configFingerprint(input) {
    const config = normalizeConfig(input);
    return `${config.provider}|${config.model}|${redactUrl(config.endpoint || "")}`;
  }

  function saveSessionSecret(input, secret = {}) {
    const config = normalizeConfig(input);
    const secrets = readJsonStorage(global.sessionStorage, SESSION_SECRET_STORAGE_KEY, {});
    secrets[configFingerprint(config)] = { apiKey: safeString(secret.apiKey || config.apiKey, 1000), externalConsent: Boolean(secret.externalConsent ?? config.externalConsent), savedAt: nowIso() };
    global.sessionStorage?.setItem?.(SESSION_SECRET_STORAGE_KEY, JSON.stringify(secrets));
  }

  async function detectCapabilities(input = {}, options = {}) {
    const config = normalizeConfig({ ...(readSharedConfig() || {}), ...input });
    const base = {
      schema: CAPABILITY_SCHEMA,
      runtimeVersion: VERSION,
      provider: config.provider,
      requestedProvider: config.requestedProvider,
      model: config.model,
      endpoint: redactUrl(config.endpoint || ""),
      detectedAt: nowIso(),
      available: true,
      probe: "declared",
      capabilities: {
        streaming: ["gemini", "ollama", "openai-compatible", "browser"].includes(config.provider) && !isAntigravityModel(config.model),
        structuredJson: ["gemini", "ollama", "openai-compatible", "hosted", "deterministic"].includes(config.provider),
        jsonSchema: ["gemini", "ollama"].includes(config.provider),
        systemPrompts: !["manual", "deterministic"].includes(config.provider),
        toolCalling: ["gemini", "openai-compatible", "hosted"].includes(config.provider),
        backgroundAgent: config.provider === "gemini" && isAntigravityModel(config.model),
        webSearch: config.provider === "gemini" && isAntigravityModel(config.model),
        urlContext: config.provider === "gemini" && isAntigravityModel(config.model),
        imageInput: ["gemini", "openai-compatible", "hosted"].includes(config.provider),
        cancellation: config.provider !== "manual",
        local: !endpointLeavesDevice(config),
      },
      notes: [],
    };
    if (config.provider === "deterministic") base.notes.push("Application-owned deterministic compiler; no network probe required.");
    if (config.provider === "manual") { base.capabilities.cancellation = false; base.notes.push("Manual exchange prepares a prompt but performs no provider request."); }
    if (config.provider === "browser") {
      base.available = Boolean((global.LanguageModel || global.ai?.languageModel)?.create);
      base.probe = "browser-api";
      if (!base.available) base.notes.push("The browser LanguageModel API is unavailable.");
    }
    if (options.probe && !["deterministic", "manual", "browser", "hosted"].includes(config.provider)) {
      const controller = makeController(options.signal, Math.min(config.timeoutMs, 20000));
      try {
        let url, headers = { ...config.headers };
        if (config.provider === "ollama") {
          const endpoint = config.endpoint || "http://127.0.0.1:11434/api/chat";
          const parsed = checkedUrl(endpoint, config); parsed.pathname = parsed.pathname.replace(/\/api\/(chat|generate)$/, "/api/tags"); url = parsed.href;
          if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
        } else if (config.provider === "gemini") {
          if (!config.apiKey) throw runtimeError("MISSING_API_KEY", "A Gemini API key is required to probe this model.");
          const baseUrl = checkedUrl(config.endpoint || "https://generativelanguage.googleapis.com/v1beta", config).href.replace(/\/+$/, "");
          url = `${baseUrl}/models/${encodeURIComponent(config.model)}`; headers["x-goog-api-key"] = config.apiKey;
        } else {
          const chat = new URL(openAIChatUrl(config.endpoint, config)); chat.pathname = chat.pathname.replace(/\/chat\/completions$/, "/models"); url = chat.href;
          if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
        }
        const response = await fetch(url, fetchOptions(url, { headers, signal: controller.signal }));
        base.available = response.ok;
        base.probe = "network";
        if (!response.ok) base.notes.push(`Capability probe returned HTTP ${response.status}.`);
      } catch (error) {
        base.available = false; base.probe = "network"; base.notes.push(safeString(error.message, 800));
      } finally { controller.cleanup(); }
    }
    const cache = readJsonStorage(global.localStorage, CAPABILITY_STORAGE_KEY, {});
    cache[configFingerprint(config)] = base;
    try { global.localStorage?.setItem?.(CAPABILITY_STORAGE_KEY, JSON.stringify(cache)); } catch {}
    dispatch("commonweave:model-capabilities", base);
    return base;
  }

  function readCachedCapabilities(input = {}) {
    const cache = readJsonStorage(global.localStorage, CAPABILITY_STORAGE_KEY, {});
    return cache[configFingerprint(input)] || null;
  }

  const api = Object.freeze({
    version: VERSION,
    resultSchema: RESULT_SCHEMA,
    capabilitySchema: CAPABILITY_SCHEMA,
    normalizeConfig,
    canonicalProvider,
    endpointLeavesDevice,
    sanitizeSchema,
    validateSchema,
    parseJsonLoose,
    extractText,
    generate,
    resultText,
    resultLabel,
    readSharedConfig,
    readModelProfiles,
    saveSharedConfig,
    saveModelProfiles,
    resolveExecutionProfile,
    generateAgentic: request => generate({ ...request, executionProfile: "agentic" }),
    generateInteractive: request => generate({ ...request, executionProfile: "interactive" }),
    saveSessionSecret,
    detectCapabilities,
    readCachedCapabilities,
    configFingerprint,
  });

  global.CommonweaveModelRuntime = api;
  dispatch("commonweave:model-runtime-ready", { version: VERSION, at: nowIso() });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
