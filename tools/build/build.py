# Rebuilds index.html from dev.html + js/ + css/ + models/ (all embedded, so it works when double-clicked from disk too).  Usage: python3 tools/build/build.py .
import subprocess, sys, os, re
root = sys.argv[1]
es = os.environ.get('ESBUILD', 'esbuild')  # install with: npm i -g esbuild (or set ESBUILD to its path)
js = subprocess.run([es, os.path.join(root, 'js/main.js'), '--bundle', '--format=iife', '--minify', '--target=es2020', '--log-level=warning'], capture_output=True, text=True)
if js.returncode: print(js.stderr); sys.exit(1)
print(js.stderr)
bundle = js.stdout.replace('</script', '<\\/script')
html = open(os.path.join(root, 'dev.html')).read()
css = ''.join(open(os.path.join(root, 'css', f)).read() + '\n' for f in ['style.css', 'career.css'])
html = html.replace('<link rel="stylesheet" href="css/style.css">\n  <link rel="stylesheet" href="css/career.css">', '<style>\n' + css + '</style>')
assert '<style>' in html
html = html.replace('<script type="module" src="js/main.js"></script>', '<script>\n' + bundle + '</script>')
assert 'src="js/main.js"' not in html
# The imported models are embedded too. Without them, index.html opened from disk (file://) cannot fetch models/*.glb
# and silently shows the built-in procedural models instead, which is what players saw before.
import base64, json
mdir = os.path.join(root, 'models')
emb = {f[:-4]: base64.b64encode(open(os.path.join(mdir, f), 'rb').read()).decode() for f in sorted(os.listdir(mdir)) if f.endswith('.glb')} if os.path.isdir(mdir) else {}
standalone = html.replace('<script>\n' + bundle, '<script>window.__ASTRO_MODELS=' + json.dumps(emb) + ';</script>\n  <script>\n' + bundle, 1)
assert not emb or '__ASTRO_MODELS' in standalone
open(os.path.join(root, 'index.html'), 'w').write(standalone)
old = os.path.join(root, 'astro-lab-standalone.html')
if os.path.exists(old): os.remove(old)  # replaced by index.html, which is now the single self-contained build
print('built index.html', len(standalone), 'bytes, models embedded:', len(emb))
