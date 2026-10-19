"""Loopback-only homepage editor and Pageant-backed Git publisher."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
REMOTE = 'git@github.com:jsmorley/jsmorley.github.io.git'
MAX_BODY = 50 * 1024 * 1024
PUBLIC_FILES = {'.nojekyll', 'index.html', 'index.htm', 'editor.html', 'app.css', 'app.js', 'publisher.js', 'seed.js', 'site-data.js', 'favicon.ico', 'Google.htm', 'RainmeterFolder.htm', 'NewsFolder.htm', 'VideoFolder.htm', 'DownloadsFolder.htm', 'NationalsFolder.htm', 'CommandersFolder.htm', 'PicturesFolder.htm', 'UZAFolder.htm'}

class PublishError(Exception):
    def __init__(self, message, status=409):
        super().__init__(message)
        self.status = status

def parse_data(text):
    try:
        value = text.split('window.HOMEPAGE_PUBLISHED', 1)[1].split('=', 1)[1].strip().removesuffix(';').strip()
        return json.loads(value)
    except (IndexError, ValueError):
        raise PublishError('The published data file has an unexpected format. Nothing was overwritten.')

def serialize(state):
    return '// Published homepage data. Includes uploaded images.\nwindow.HOMEPAGE_PUBLISHED = ' + json.dumps(state, ensure_ascii=False, indent=2) + ';\n'

def validate(state):
    if not isinstance(state, dict) or state.get('version') != 1 or not isinstance(state.get('pages'), list) or not 1 <= len(state['pages']) <= 500:
        raise PublishError('Invalid homepage data.', 400)
    ids = []
    for page in state['pages']:
        if not isinstance(page, dict) or not isinstance(page.get('id'), str) or not isinstance(page.get('title'), str) or not isinstance(page.get('items'), list) or len(page['items']) > 5000:
            raise PublishError('Invalid folder data.', 400)
        ids.append(page['id'])
        for item in page['items']:
            if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not isinstance(item.get('title'), str):
                raise PublishError('Invalid item data.', 400)
    if len(set(ids)) != len(ids) or state.get('home') not in ids:
        raise PublishError('Invalid homepage folders.', 400)

class GitPublisher:
    def __init__(self, root=ROOT, remote=REMOTE, git=None, env=None):
        self.root = Path(root).resolve()
        self.repo = self.root / '.publisher' / 'repository'
        self.remote = remote
        self.git = git or shutil.which('git') or 'C:/Program Files/Git/cmd/git.exe'
        self.env = dict(os.environ if env is None else env)
        self.env.update(GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='Never')
        if remote == REMOTE:
            plink = Path('C:/Program Files/PuTTY/plink.exe')
            if not plink.is_file():
                raise PublishError('PuTTY plink.exe is missing. Install PuTTY and start Pageant.', 503)
            self.env.update(GIT_SSH_COMMAND='"' + plink.as_posix() + '" -batch', GIT_SSH_VARIANT='plink')
        self.lock = threading.Lock()
        self.current_text = None

    def command(self, *args, cwd=None):
        try:
            result = subprocess.run([self.git, *args], cwd=cwd or self.repo, env=self.env, capture_output=True, encoding='utf-8', errors='replace', timeout=90)
        except (OSError, subprocess.TimeoutExpired):
            raise PublishError('Git could not run or timed out. Check your connection and Pageant, then retry.', 503)
        if result.returncode:
            action = args[0]
            if action == 'push':
                raise PublishError('The commit was saved locally, but GitHub did not accept the push. Check your connection and Pageant, then click Commit and publish again. No force push was used.', 503)
            raise PublishError(f'Git {action} failed. Check that Pageant is running with your GitHub key loaded, and that the publisher checkout has no manual changes.', 503)
        return result.stdout.strip()

    def prepare(self):
        assert self.repo.resolve().is_relative_to(self.root / '.publisher')
        if not (self.repo / '.git').is_dir():
            self.repo.parent.mkdir(parents=True, exist_ok=True)
            self.command('clone', '--branch', 'master', self.remote, str(self.repo), cwd=self.root)
        if self.command('remote', 'get-url', 'origin') != self.remote or self.command('branch', '--show-current') != 'master':
            raise PublishError('Unexpected publisher repository or branch. Nothing was changed.')
        if self.command('status', '--porcelain'):
            raise PublishError('The publisher checkout has manual changes. Preserve those changes before publishing.')
        self.command('fetch', 'origin', 'master')
        self.current_text = self.command('show', 'FETCH_HEAD:site-data.js') + '\n'

    def publish(self, state, expected, message):
        validate(state)
        if not isinstance(message, str) or len(message) > 500 or '\x00' in message:
            raise PublishError('Enter a commit message of up to 500 characters.', 400)
        if not self.lock.acquire(blocking=False):
            raise PublishError('Another publish is in progress. Wait for it to finish.')
        try:
            self.prepare()
            remote_state = parse_data(self.current_text)
            if remote_state == state:
                self.save_local(self.current_text)
                return {'unchanged': True}
            if remote_state != expected:
                raise PublishError('The published bookmarks changed since this editor loaded. Back up your draft, then reload and review the newer version. Nothing was overwritten.')
            self.command('merge', '--ff-only', 'FETCH_HEAD')
            current_head = parse_data(self.command('show', 'HEAD:site-data.js'))
            if current_head != state:
                (self.repo / 'site-data.js').write_text(serialize(state), encoding='utf-8', newline='\n')
                self.command('add', '--', 'site-data.js')
                self.command('commit', '-m', message.strip() or 'Update homepage bookmarks from PC editor')
            self.command('push', 'origin', 'HEAD:master')
            commit = self.command('rev-parse', 'HEAD')
            self.current_text = serialize(state)
            self.save_local(self.current_text)
            return {'commit': commit, 'url': 'https://github.com/jsmorley/jsmorley.github.io/commit/' + commit}
        finally:
            self.lock.release()

    def save_local(self, text):
        temporary = self.root / 'site-data.js.tmp'
        temporary.write_text(text, encoding='utf-8', newline='\n')
        temporary.replace(self.root / 'site-data.js')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def authorized_host(self):
        return self.headers.get('Host') in {'localhost:4000', '127.0.0.1:4000'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        super().end_headers()

    def respond(self, status, value):
        data = json.dumps(value).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        if not self.authorized_host():
            return self.respond(403, {'error': 'Use http://localhost:4000.'})
        path = unquote(urlsplit(self.path).path)
        if path == '/__local/status':
            return self.respond(200, {'enabled': True, 'csrf': self.server.csrf, 'repository': 'jsmorley/jsmorley.github.io', 'authentication': 'Pageant'})
        if path == '/site-data.js' and self.server.publisher.current_text is not None:
            data = self.server.publisher.current_text.encode('utf-8')
            self.send_response(200); self.send_header('Content-Type', 'text/javascript; charset=utf-8'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        relative = path.lstrip('/') or 'index.html'
        asset = Path(relative)
        is_image = asset.parts and asset.parts[0] == 'Images' and len(asset.parts) == 2 and asset.suffix.lower() in {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico'}
        if is_image:
            is_image = (ROOT / asset).resolve().is_relative_to((ROOT / 'Images').resolve()) and ':' not in asset.name
        if relative not in PUBLIC_FILES and not is_image:
            return self.respond(404, {'error': 'Not found'})
        super().do_GET()

    def do_HEAD(self):
        return self.respond(405, {'error': 'Use GET.'})

    def do_POST(self):
        if not self.authorized_host() or self.headers.get('Origin') not in {'http://localhost:4000', 'http://127.0.0.1:4000'} or not secrets.compare_digest(self.headers.get('X-Homepage-CSRF', ''), self.server.csrf):
            return self.respond(403, {'error': 'Publishing is available only from this PC editor.'})
        if self.path != '/__local/publish' or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.respond(400, {'error': 'Invalid publish request.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY:
                return self.respond(413, {'error': 'The publish request is too large.'})
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict) or 'expected' not in payload:
                raise PublishError('Invalid publish request.', 400)
            result = self.server.publisher.publish(payload.get('state'), payload['expected'], payload.get('message', ''))
            self.respond(200, result)
        except PublishError as error:
            self.respond(error.status, {'error': str(error)})
        except (ValueError, TypeError):
            self.respond(400, {'error': 'Invalid publish request.'})
        except Exception:
            self.respond(500, {'error': 'Publishing failed. Your browser draft is unchanged. Check the helper window.'})

def main():
    publisher = GitPublisher()
    try:
        print('Refreshing published data through Pageant...', flush=True)
        publisher.prepare()
    except PublishError as error:
        print(str(error) + ' You can still edit locally and retry publishing later.', flush=True)
    server = ThreadingHTTPServer(('127.0.0.1', 4000), Handler)
    server.csrf = secrets.token_urlsafe(32)
    server.publisher = publisher
    print('PC editor: http://localhost:4000/editor.html', flush=True)
    print('Publishing uses Pageant. Keep this helper running; Ctrl+C stops it.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
