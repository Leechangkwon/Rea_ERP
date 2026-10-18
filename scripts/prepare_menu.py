"""Build the observed, sanitized menu hierarchy; no session URLs are retained."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'analysis/menus.tsv'
tree = []
for line in source.read_text(encoding='utf-8').splitlines():
    top, group, raw = line.split('\t')
    if not tree or tree[-1]['name'] != top:
        tree.append({'name': top, 'groups': []})
    items = []
    for item in raw.split(';'):
        parts = item.split('>', 1)
        items.append({'name': parts[0], 'children': parts[1].split('|') if len(parts) == 2 else []})
    tree[-1]['groups'].append({'name': group, 'items': items})
counts = {'top': len(tree), 'groups': sum(len(t['groups']) for t in tree),
          'items': sum(len(g['items']) for t in tree for g in t['groups']),
          'leaves': sum(len(i['children']) for t in tree for g in t['groups'] for i in g['items'])}
if counts != {'top': 10, 'groups': 59, 'items': 248, 'leaves': 511}:
    raise ValueError(f'Observed menu counts changed: {counts}')
(ROOT / 'dist/menus.json').write_text(json.dumps(tree, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
proof = {'observed_on': '2026-10-15', 'scope': 'Rendered sitemap labels and hierarchy, scoped to the signed-in account menu configuration',
         'counts': counts, 'catalog_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
         'private_data_retained': False, 'source': 'Ecount rendered page DOM via supported in-app browser',
         'style': {'bookmark_height': 26, 'navigation_height': 72, 'font': 'Malgun Gothic', 'base_font_px': 12,
                   'bookmark_background': '#e9ecef', 'page_background': '#f5f6f8'}}
(ROOT / 'evidence/ui-observations.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(counts))
