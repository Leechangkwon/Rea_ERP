"""Verify the sanitized menu transcription and the public REA source inventory."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
tree = json.loads((ROOT / 'dist/menus.json').read_text(encoding='utf-8'))
canonical_tree = [[top['name'], [[group['name'], [[item['name'], [[child] for child in item['children']]]
                   for item in group['items']]] for group in top['groups']]] for top in tree]
canonical = json.dumps(canonical_tree, ensure_ascii=False, separators=(',', ':'))
checksum = 2166136261
for (unit,) in struct.iter_unpack('<H', canonical.encode('utf-16le')):
    checksum = ((checksum ^ unit) * 16777619) & 0xffffffff
observed = {'utf16_length': 10434, 'fnv1a_utf16': '3f7816c6'}
actual = {'utf16_length': len(canonical.encode('utf-16le')) // 2, 'fnv1a_utf16': f'{checksum:08x}'}
if actual != observed:
    raise ValueError(f'Menu labels/hierarchy differ from rendered source: {actual}')
manifest = json.loads((ROOT / 'evidence/public-sources.json').read_text(encoding='utf-8'))
for record in manifest:
    raw = (ROOT / 'analysis/source' / record['name']).read_bytes()
    if len(raw) != record['bytes'] or hashlib.sha256(raw).hexdigest() != record['sha256']:
        raise ValueError('Public source integrity mismatch')
rea = json.loads((ROOT / 'evidence/rea-application.json').read_text(encoding='utf-8'))
result = rea['normalized_result']
stats = result['statistics']
if stats['parsed_javascript_files'] != 4 or stats['parse_failures']:
    raise ValueError('REA static analysis did not parse the selected public scripts')
source_name = 'bundle.menu.-4230133589129103184.20.js'
source = (ROOT / 'analysis/source' / source_name).read_text(encoding='utf-8')
observations = []
for token, meaning in [('ecount.widget.PROCESSBOOKMARK', 'A bookmark-processing event label is present.'),
                       ('getMenuApiDataRequire', 'Menu data can be loaded through a dynamic require helper.'),
                       ('ecount.control.menu', 'A menu control class is declared.'),
                       ('useFavoriteCode', 'A favorite-code selection option is present.')]:
    start = source.find(token)
    if start < 0:
        raise ValueError('Expected observed source token missing')
    observations.append({'file': source_name, 'token': token, 'character_offset': start,
                         'utf8_byte_offset': len(source[:start].encode('utf-8')),
                         'meaning': meaning, 'scope': 'Direct static source observation, not a runtime proof'})
report = {'status': 'passed', 'rea_version': '6.4.0', 'menu_labels_and_hierarchy_match': True,
          'observed_menu_checksum': observed, 'actual_menu_checksum': actual,
          'menu_json_sha256': hashlib.sha256((ROOT / 'dist/menus.json').read_bytes()).hexdigest(),
          'rea_statistics': stats, 'source_observations': observations,
          'limitations': result['limitations'] + [
              'Only four public CDN scripts observed in the live page were included.',
              'Static parsing does not prove the selected helpers power every current UI transition.',
              'The live rendered sitemap and observed UI transitions supply the menu/UI evidence.',
              'The sample independently implements navigation and does not execute original application code or call ERP APIs.',
              'The menu snapshot reflects the signed-in account configuration, not every Ecount feature or permission.']}
(ROOT / 'evidence/analysis-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'status': 'passed', 'menu_match': True, 'rea': stats}))
