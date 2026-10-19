/* GitHub Contents API publisher. Tokens are passed in memory, never persisted. */
(() => {
  'use strict';
  const api = 'https://api.github.com/repos/jsmorley/jsmorley.github.io';
  function encode(text) {
    const bytes = new TextEncoder().encode(text); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  function decode(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g, '')), c => c.charCodeAt(0))); }
  function parsePublished(text) {
    const match = text.match(/window\.HOMEPAGE_PUBLISHED\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!match) throw Error('The repository data file has an unexpected format. Nothing was overwritten.');
    return JSON.parse(match[1]);
  }
  function serialize(state) { return '// Published homepage data. Includes uploaded images.\nwindow.HOMEPAGE_PUBLISHED = ' + JSON.stringify(state, null, 2) + ';\n'; }
  async function publish({ token, state, expected, message, fetcher = fetch }) {
    if (!token || !token.trim()) throw Error('Enter your GitHub token.');
    const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token.trim(), 'X-GitHub-Api-Version': '2022-11-28' };
    async function request(path, options = {}) {
      let response;
      try { response = await fetcher(api + path, { ...options, headers: { ...headers, ...options.headers }, cache: 'no-store', redirect: 'error' }); }
      catch { throw Error(options.method === 'PUT' ? 'The publish response was interrupted. Check the repository before retrying; the commit may have succeeded.' : 'Could not connect to GitHub. Check your connection and try again.'); }
      if (!response.ok) {
        const descriptions = { 401: 'GitHub rejected the token. Check that it is correct and has not expired.', 403: 'GitHub denied publishing. Give this token Contents read/write access to this repository, or check GitHub’s rate limit.', 404: 'GitHub could not access site-data.js. Check the selected repository and token access.', 409: 'The repository changed while publishing. Reload the editor before retrying.', 422: 'GitHub could not create this commit. Check repository branch rules and file size.' };
        throw Error(descriptions[response.status] || 'GitHub returned HTTP ' + response.status + '. Your local draft is still saved.');
      }
      return response.json();
    }
    const current = await request('/contents/site-data.js?ref=master');
    let raw = current;
    if (current.encoding !== 'base64' || !current.content) raw = await request('/git/blobs/' + encodeURIComponent(current.sha));
    const remote = parsePublished(decode(raw.content));
    if (JSON.stringify(remote) === JSON.stringify(state)) return { unchanged: true, published: state };
    if (JSON.stringify(remote) !== JSON.stringify(expected)) throw Error('The published bookmarks changed since this editor loaded. Back up your draft, then reload and review the newer version before publishing. Nothing was overwritten.');
    const content = serialize(state);
    if (new TextEncoder().encode(content).length > 50 * 1024 * 1024) throw Error('The data file is too large. Use smaller images before publishing.');
    const result = await request('/contents/site-data.js', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() || 'Update homepage bookmarks from editor', branch: 'master', sha: current.sha, content: encode(content) })
    });
    return { commit: result.commit.sha, url: result.commit.html_url, published: state };
  }
  const exported = { publish, serialize, parsePublished, encode, decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else window.HomepagePublisher = exported;
})();
