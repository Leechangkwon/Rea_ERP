"""Download only static CDN script URLs observed in the user's rendered page."""
import hashlib
import gzip
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    'https://resource.ecount.com/ec5/static/freq/ecountv5/modules/ecount.browser.entry/ecount.browser.entry.10f53951.20.js',
    'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/js/require/require.menu.-5824661678542153224.20.js',
    'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/bundle/bundle.menu.base.-1915567871399218329.20.js',
    'https://resourcev3.ecount.com/ec3/freq/ecerp/contents/bundle/bundle.menu.-4230133589129103184.20.js',
]
manifest = []
for url in SOURCES:
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
        data = response.read(8_000_001)
        if response.status != 200 or len(data) > 8_000_000 or 'javascript' not in response.headers.get('Content-Type', '').lower():
            raise ValueError('Unexpected static resource response')
        if data[:2] == b'\x1f\x8b':
            with gzip.GzipFile(fileobj=io.BytesIO(data)) as compressed:
                data = compressed.read(8_000_001)
            if len(data) > 8_000_000:
                raise ValueError('Expanded script exceeds analysis limit')
        data.decode('utf-8')
    name = url.rsplit('/', 1)[1]
    (ROOT / 'analysis/source' / name).write_bytes(data)
    manifest.append({'name': name, 'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'authenticated': False})
    print(name, len(data), flush=True)
(ROOT / 'evidence/public-sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
