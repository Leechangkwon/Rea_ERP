'use strict';

// Independent, disconnected review of the observed V5 client save projection.
// Diagnostics are conservative review guards, not original server validation.
function reviewListTabSave(rawJson) {
  if (typeof rawJson !== 'string') throw new TypeError('리스트탭 JSON 원문이 필요합니다.');
  let snapshot;
  try { snapshot = JSON.parse(rawJson); }
  catch { throw new SyntaxError('리스트탭 JSON 원문을 확인하세요.'); }
  const diagnostics = [], rows = [], seen = new Set();
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const issue = (code, path) => diagnostics.push({code, path});
  const identifier = value => typeof value === 'string' && value.trim().length > 0;
  const visit = (row, path, kind) => {
    if (!record(row)) { issue('ROW_SHAPE', path); return; }
    let valid = true;
    for (const [field, accepts] of [
      ['id', identifier],
      ['display_order', value => typeof value === 'number' && Number.isFinite(value)],
      ['is_display_default', value => typeof value === 'boolean'],
      ['display_tf', value => typeof value === 'boolean']
    ]) {
      if (!Object.hasOwn(row, field) || !accepts(row[field])) {
        issue('FIELD_REVIEW', path + '.' + field); valid = false;
      }
    }
    if (identifier(row.id)) {
      if (seen.has(row.id)) issue('DUPLICATE_ID_REVIEW', path + '.id');
      seen.add(row.id);
    }
    if (valid) rows.push({path, kind, values:{
      bizz_information_sid:row.id,
      num_001:row.display_order,
      tf_001:row.is_display_default,
      tf_002:row.display_tf
    }});
    if (row.children === undefined || row.children === null) return;
    if (!Array.isArray(row.children)) { issue('CHILDREN_SHAPE', path + '.children'); return; }
    if (kind === 'child') {
      if (row.children.length) issue('NESTING_REVIEW', path + '.children');
      return;
    }
    row.children.forEach((child, index) => visit(child, path + '.children[' + index + ']', 'child'));
  };
  if (!record(snapshot)) issue('SNAPSHOT_SHAPE', '$');
  else {
    if (!identifier(snapshot.bizz_sid)) issue('SCOPE_REVIEW', '$.bizz_sid');
    if (!Array.isArray(snapshot.tab_data)) issue('TABS_SHAPE', '$.tab_data');
    else {
      if (!snapshot.tab_data.length) issue('EMPTY_REVIEW', '$.tab_data');
      snapshot.tab_data.forEach((row, index) => visit(row, '$.tab_data[' + index + ']', 'parent'));
    }
  }
  return {
    format:'rea-list-tab-save-review', version:1,
    status:diagnostics.length ? 'review-required' : 'proposal-only',
    canApply:false, appIntegrated:false,
    rawJson, snapshot, rows, diagnostics,
    proposal:diagnostics.length ? null : {
      bizz_sid:snapshot.bizz_sid, save:rows.map(row => ({...row.values}))
    },
    originalMenuMetadataVerified:false,
    originalPermissionAndPersistenceVerified:false
  };
}

module.exports = {reviewListTabSave};
