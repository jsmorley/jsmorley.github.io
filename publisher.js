/* Same-origin PC helper client. No GitHub tokens are needed or stored. */
(() => {
  'use strict';
  let csrf = '';
  function serialize(state) { return '// Published homepage data. Includes uploaded images.\nwindow.HOMEPAGE_PUBLISHED = ' + JSON.stringify(state, null, 2) + ';\n'; }
  async function localStatus(fetcher = fetch, hostname = location.hostname) {
    if (!['localhost', '127.0.0.1'].includes(hostname)) return false;
    try {
      const response = await fetcher('/__local/status', { cache: 'no-store' });
      if (!response.ok) return false;
      const result = await response.json();
      csrf = result.enabled && typeof result.csrf === 'string' ? result.csrf : '';
      return Boolean(csrf);
    } catch { return false; }
  }
  async function publish({state, expected, message, fetcher = fetch}) {
    if (!csrf) throw Error('Start start-local.cmd on your PC, then open http://localhost:4000/editor.html.');
    let response;
    try {
      response = await fetcher('/__local/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Homepage-CSRF': csrf },
        body: JSON.stringify({state, expected, message}), redirect: 'error'
      });
    } catch { throw Error('The helper connection was interrupted. Check GitHub before retrying; the commit may have succeeded.'); }
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Publishing failed. Your draft is still saved.');
    return result;
  }
  const exported = {publish, localStatus, serialize};
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else window.HomepagePublisher = exported;
})();
