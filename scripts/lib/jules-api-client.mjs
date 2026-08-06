export class JulesApiError extends Error {
  constructor(message, {status = 0, body = null, retryAfter = null} = {}) {
    super(message);
    this.name = 'JulesApiError';
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

export class JulesApiClient {
  constructor({apiKey, baseUrl = 'https://jules.googleapis.com/v1alpha', fetchImpl = globalThis.fetch}) {
    if (!apiKey) throw new Error('JULES_API_KEY is required.');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  async request(path, {method = 'GET', body} = {}) {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = {raw: text}; }
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `Jules API returned ${response.status}.`;
      throw new JulesApiError(message, {
        status: response.status,
        body: payload,
        retryAfter: response.headers.get('retry-after')
      });
    }
    return payload || {};
  }

  async listSessions({pageSize = 100, maxPages = 5} = {}) {
    const sessions = [];
    let token = '';
    for (let page = 0; page < maxPages; page += 1) {
      const query = new URLSearchParams({pageSize: String(pageSize)});
      if (token) query.set('pageToken', token);
      const payload = await this.request(`/sessions?${query}`);
      sessions.push(...(payload.sessions || []));
      token = payload.nextPageToken || '';
      if (!token) break;
    }
    return sessions;
  }

  async getSession(name) {
    return this.request(`/${normalizeResource(name, 'sessions')}`);
  }

  async listSources({pageSize = 100, maxPages = 5} = {}) {
    const sources = [];
    let token = '';
    for (let page = 0; page < maxPages; page += 1) {
      const query = new URLSearchParams({pageSize: String(pageSize)});
      if (token) query.set('pageToken', token);
      const payload = await this.request(`/sources?${query}`);
      sources.push(...(payload.sources || []));
      token = payload.nextPageToken || '';
      if (!token) break;
    }
    return sources;
  }

  async createSession({prompt, title, source, startingBranch = 'main', requirePlanApproval = false}) {
    return this.request('/sessions', {
      method: 'POST',
      body: {
        prompt,
        title,
        sourceContext: {
          source,
          githubRepoContext: {startingBranch}
        },
        requirePlanApproval,
        automationMode: 'AUTO_CREATE_PR'
      }
    });
  }

  async sendMessage(name, prompt) {
    return this.request(`/${normalizeResource(name, 'sessions')}:sendMessage`, {
      method: 'POST',
      body: {prompt}
    });
  }
}

function normalizeResource(name, collection) {
  const value = String(name || '').replace(/^\//, '');
  if (!value.startsWith(`${collection}/`)) throw new Error(`Invalid ${collection} resource name.`);
  return value;
}
