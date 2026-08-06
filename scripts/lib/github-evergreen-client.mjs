export class GitHubApiClient {
  constructor({token, repository, fetchImpl = globalThis.fetch}) {
    if (!token) throw new Error('A GitHub token is required.');
    if (!repository?.includes('/')) throw new Error('GITHUB_REPOSITORY must be owner/name.');
    this.token = token;
    this.repository = repository;
    this.fetch = fetchImpl;
    this.baseUrl = `https://api.github.com/repos/${repository}`;
  }

  async request(path, {method = 'GET', body, allow404 = false, accept = 'application/vnd.github+json'} = {}) {
    const response = await this.fetch(path.startsWith('http') ? path : `${this.baseUrl}${path}`, {
      method,
      headers: {
        accept,
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (allow404 && response.status === 404) return null;
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = {raw: text}; }
    }
    if (!response.ok) {
      throw new Error(payload?.message || `GitHub API returned ${response.status} for ${path}.`);
    }
    return payload || {};
  }

  getPullRequest(number) {
    return this.request(`/pulls/${number}`);
  }

  async listOpenPullRequests() {
    return this.request('/pulls?state=open&per_page=100&sort=updated&direction=desc');
  }

  async listPullRequestFiles(number, {maxPages = 5} = {}) {
    const files = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const batch = await this.request(`/pulls/${number}/files?per_page=100&page=${page}`);
      files.push(...batch);
      if (batch.length < 100) break;
    }
    return files;
  }

  listPullRequestReviews(number) {
    return this.request(`/pulls/${number}/reviews?per_page=100`);
  }

  getCheckRuns(sha) {
    return this.request(`/commits/${sha}/check-runs?per_page=100`);
  }

  getCombinedStatus(sha) {
    return this.request(`/commits/${sha}/status?per_page=100`);
  }

  listComments(number) {
    return this.request(`/issues/${number}/comments?per_page=100`);
  }

  addComment(number, body) {
    return this.request(`/issues/${number}/comments`, {method: 'POST', body: {body}});
  }

  async getFileContent(filePath, ref) {
    const payload = await this.request(`/contents/${encodePath(filePath)}?ref=${encodeURIComponent(ref)}`);
    if (payload.encoding !== 'base64') throw new Error(`Unsupported encoding for ${filePath}.`);
    return Buffer.from(String(payload.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  }

  async ensureLabel({name, color, description}) {
    const encoded = encodeURIComponent(name);
    const existing = await this.request(`/labels/${encoded}`, {allow404: true});
    if (existing) return existing;
    return this.request('/labels', {method: 'POST', body: {name, color, description}});
  }

  addLabels(number, labels) {
    return this.request(`/issues/${number}/labels`, {method: 'POST', body: {labels}});
  }

  removeLabel(number, label) {
    return this.request(`/issues/${number}/labels/${encodeURIComponent(label)}`, {method: 'DELETE', allow404: true});
  }

  async convertPullRequestToDraft(nodeId) {
    return this.graphql(
      'mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){pullRequest{isDraft}}}',
      {id: nodeId},
      payload => payload.data.convertPullRequestToDraft.pullRequest
    );
  }

  async markPullRequestReadyForReview(nodeId) {
    return this.graphql(
      'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{isDraft}}}',
      {id: nodeId},
      payload => payload.data.markPullRequestReadyForReview.pullRequest
    );
  }

  mergePullRequest(number, {method = 'squash', sha, commitTitle, commitMessage} = {}) {
    return this.request(`/pulls/${number}/merge`, {
      method: 'PUT',
      body: {
        merge_method: method,
        sha,
        commit_title: commitTitle,
        commit_message: commitMessage
      }
    });
  }

  async graphql(query, variables, extract) {
    const response = await this.fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28'
      },
      body: JSON.stringify({query, variables})
    });
    const payload = await response.json();
    if (!response.ok || payload.errors?.length) {
      throw new Error(payload.errors?.[0]?.message || `GitHub GraphQL returned ${response.status}.`);
    }
    return extract(payload);
  }
}

function encodePath(filePath) {
  return String(filePath).split('/').map(encodeURIComponent).join('/');
}
