"""Integration checks against a disposable local Git remote; never writes to GitHub."""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch, Mock
from local_server import GitPublisher, PublishError, Handler, parse_data, serialize

class PublisherTests(unittest.TestCase):
    def test_browser_request_boundaries(self):
        handler = Handler.__new__(Handler)
        handler.server = SimpleNamespace(csrf='expected-secret', publisher=Mock())
        handler.respond = Mock()
        handler.path = '/__local/publish'
        handler.headers = {'Host':'localhost:5000','Origin':'https://unrelated.example','X-Homepage-CSRF':'expected-secret'}
        handler.do_POST(); self.assertEqual(handler.respond.call_args.args[0],403)
        handler.headers['Origin'] = 'http://localhost:5000'
        handler.headers['X-Homepage-CSRF'] = 'wrong'
        handler.do_POST(); self.assertEqual(handler.respond.call_args.args[0],403)
        handler.headers['Host'] = 'unrelated.example:5000'
        handler.headers['X-Homepage-CSRF'] = 'expected-secret'
        handler.do_POST(); self.assertEqual(handler.respond.call_args.args[0],403)
        handler.server.publisher.publish.assert_not_called()
        handler.headers = {'Host':'localhost:5000'}
        for path in ['/backups/original.zip','/.publisher/repository/.git/config','/.deployment/repository/.git/config','/tools/local_server.py','/Images/../.git/config']:
            handler.path = path; handler.do_GET(); self.assertEqual(handler.respond.call_args.args[0],404)

    def test_git_roundtrip_and_recovery(self):
        with tempfile.TemporaryDirectory(prefix='homepage-git-test-') as temporary:
            root = Path(temporary)
            remote = root / 'remote.git'
            seed = root / 'seed'
            pc = root / 'pc'; pc.mkdir()
            env = dict(os.environ, GIT_AUTHOR_NAME='Homepage test', GIT_AUTHOR_EMAIL='test@example.invalid', GIT_COMMITTER_NAME='Homepage test', GIT_COMMITTER_EMAIL='test@example.invalid')
            def git(*args, cwd=root):
                return subprocess.check_output(['git', *map(str, args)], cwd=cwd, env=env, stderr=subprocess.STDOUT, text=True, encoding='utf-8').strip()
            git('init', '--bare', '--initial-branch=master', remote)
            git('clone', remote, seed)
            (seed / 'site-data.js').write_text(serialize(None), encoding='utf-8')
            (seed / 'keep.txt').write_text('Leave this file unchanged', encoding='utf-8')
            git('add', '.', cwd=seed); git('commit', '-m', 'Initial data', cwd=seed); git('push', 'origin', 'master', cwd=seed)
            publisher = GitPublisher(pc, str(remote), env=env)
            publisher.prepare()
            self.assertIsNone(parse_data(publisher.current_text))
            state = {'version':1,'home':'home','pages':[{'id':'home','title':'Café 日本語','items':[]}]}
            result = publisher.publish(state, None, 'Publish through local helper')
            self.assertEqual(len(result['commit']), 40)
            self.assertEqual(parse_data(git('--git-dir', remote, 'show', 'master:site-data.js')), state)
            self.assertEqual(git('--git-dir', remote, 'show', 'master:keep.txt'), 'Leave this file unchanged')
            self.assertEqual(parse_data((pc / 'site-data.js').read_text(encoding='utf-8')), state)
            self.assertTrue(publisher.publish(state, None, 'No duplicate commit')['unchanged'])
            newer = copy.deepcopy(state); newer['pages'][0]['title'] = 'New title'
            with self.assertRaisesRegex(PublishError, 'changed since'):
                publisher.publish(newer, None, 'Stale draft')
            command = publisher.command
            def interrupted(*args, **kwargs):
                if args[0] == 'push': raise PublishError('Simulated push interruption', 503)
                return command(*args, **kwargs)
            with patch.object(publisher, 'command', side_effect=interrupted):
                with self.assertRaisesRegex(PublishError, 'interruption'):
                    publisher.publish(newer, state, 'Retryable commit')
            pending = command('rev-parse', 'HEAD')
            recovered = publisher.publish(newer, state, 'Retryable commit')
            self.assertEqual(recovered['commit'], pending, 'Retry must push the existing commit')
            self.assertEqual(parse_data(git('--git-dir', remote, 'show', 'master:site-data.js')), newer)
            (publisher.repo / 'manual.txt').write_text('Manual work', encoding='utf-8')
            with self.assertRaisesRegex(PublishError, 'manual changes'):
                publisher.publish(state, newer, 'Do not overwrite manual work')

if __name__ == '__main__': unittest.main()
