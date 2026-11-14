"""Isolated public browser qualification; no app install/build or local environment."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import urllib.request

repo = Path.cwd()
out = Path(os.environ['PAROLA_BACKUP_OUTPUT'])
out.mkdir()
root = Path(tempfile.mkdtemp(prefix='parola-backup-', dir=os.environ['RUNNER_TEMP']))
env = {**os.environ, 'PAROLA_BACKUP_ROOT': str(root), 'PAROLA_BACKUP_OUTPUT': str(out), 'npm_config_cache': str(root / 'cache'), 'npm_config_userconfig': str(root / 'empty.npmrc'), 'PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD': '1'}
(root / 'empty.npmrc').write_text('')
receipt = {'source': os.environ['GITHUB_SHA'], 'commands': [], 'cleanup': False, 'passed': False}


def source():
    result = []
    for name in subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0'):
        if name:
            p = repo / name
            assert p.is_file() and not p.is_symlink()
            data = p.read_bytes()
            result.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    assert subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--']).returncode == 0
    return result


def run(name, args, timeout):
    result = subprocess.run(args, env=env, capture_output=True, timeout=timeout)
    for kind, data in [('stdout', result.stdout), ('stderr', result.stderr)]:
        (out / (name + '.' + kind)).write_bytes(data)
    receipt['commands'].append({'name': name, 'exitCode': result.returncode, 'stdoutSha256': hashlib.sha256(result.stdout).hexdigest(), 'stderrSha256': hashlib.sha256(result.stderr).hexdigest()})
    print(name, result.returncode, flush=True)
    assert result.returncode == 0, name + ' failed'


def assets(phase):
    rows = []
    for name in ['index.html', 'app.mjs', 'engine.mjs', 'data.mjs', 'reminders.mjs', 'styles.css', 'theme.css', 'manifest.webmanifest', 'icon.svg', 'sw.js']:
        expected = (repo / 'public' / name).read_bytes()
        with urllib.request.urlopen('https://parola-eta.vercel.app/' + name, timeout=10) as response:
            data = response.read(1_048_577)
            assert response.status == 200 and data == expected and len(data) <= 1_048_576
        rows.append({'path': '/' + name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    (out / ('assets-' + phase + '.json')).write_text(json.dumps(rows, indent=2) + '\n')
    return rows


try:
    before = source()
    (out / 'source-before.json').write_text(json.dumps(before, indent=2) + '\n')
    served = assets('before')
    run('driver', ['npm', 'install', '--prefix', str(root / 'tools'), '--no-save', '--package-lock=false', '--no-audit', '--no-fund', '--ignore-scripts', 'playwright@1.64.1'], 150)
    package = json.loads((root / 'tools/node_modules/playwright/package.json').read_text())
    assert package['version'] == '1.64.1'
    env['PAROLA_BACKUP_PLAYWRIGHT'] = str(root / 'tools/node_modules/playwright/index.mjs')
    run('browser', ['node', 'tests/browser/backup-recovery.mjs'], 240)
    report = json.loads((out / 'browser-report.json').read_text())
    assert report['status'] == 'passed' and len(report['cases']) == 4 and all(item['passed'] for item in report['cases'])
    assert report['contextsClosed'] == report['contextsCreated'] == 4
    assert assets('after') == served
    after = source()
    (out / 'source-after.json').write_text(json.dumps(after, indent=2) + '\n')
    assert before == after
    receipt['passed'] = True
finally:
    processes = subprocess.check_output(['ps', '-eo', 'pid,args'], text=True)
    remaining = [line for line in processes.splitlines() if str(root) in line]
    receipt['remainingOwnedProcesses'] = remaining
    if not remaining:
        shutil.rmtree(root)
        receipt['cleanup'] = not root.exists()
    (out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    assert receipt['cleanup'], 'Owned browser/driver cleanup is unverified'
