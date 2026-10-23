'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {reviewListTabSave} = require('../scripts/lib/list-tab-save-review.cjs');
const row = (id, extra={}) => ({id, display_order:0, is_display_default:false, display_tf:true, ...extra});
const input = tab_data => ({bizz_sid:' BIZ-구매 ', menu_sid:'MENU-REQUEST', tab_data});
const review = value => reviewListTabSave(JSON.stringify(value));

test('projects existing parent and child IDs in input order with only the three observed settings', () => {
  const value = input([
    row('P2', {display_order:9, name:'name is not a setting write', value:'Y', use:false,
      children:[row(' C1 ', {display_order:3, sid:'not-the-storage-id', use_tf:false, display_tf:false})]}),
    row('P1', {display_order:1, children:[row('C2', {display_order:2, is_display_default:true})]})
  ]);
  const out = review(value);
  assert.equal(out.status, 'proposal-only');
  assert.deepEqual(out.proposal, {bizz_sid:' BIZ-구매 ', save:[
    {bizz_information_sid:'P2', num_001:9, tf_001:false, tf_002:true},
    {bizz_information_sid:' C1 ', num_001:3, tf_001:false, tf_002:false},
    {bizz_information_sid:'P1', num_001:1, tf_001:false, tf_002:true},
    {bizz_information_sid:'C2', num_001:2, tf_001:true, tf_002:true}
  ]});
  assert.deepEqual(out.rows.map(x => x.kind), ['parent','child','parent','child']);
});

test('retains exact JSON text and unknown metadata without writing names, status codes or menu scope', () => {
  const value = input([row('P', {name:'기존 이름', value:'N', children:[row('C', {sid:'STATUS-CODE', custom:{keep:[0,false,'']}})]})]);
  value.future = JSON.parse('{"__proto__":"plain JSON data","nested":{"precision":null}}');
  const raw = JSON.stringify(value, null, 2) + '\n';
  const out = reviewListTabSave(raw);
  assert.equal(out.rawJson, raw); assert.deepEqual(out.snapshot, value);
  assert.equal(Object.hasOwn(out.snapshot.future, '__proto__'), true);
  assert.deepEqual(Object.keys(out.proposal), ['bizz_sid','save']);
  assert.ok(out.proposal.save.every(x => Object.keys(x).join(',') === 'bizz_information_sid,num_001,tf_001,tf_002'));
});

test('hidden and unused parents and children remain in the proposal', () => {
  const out = review(input([row('P', {use:false, display_tf:false, children:[row('C', {use_tf:false, display_tf:false})]})]));
  assert.deepEqual(out.proposal.save.map(x => [x.bizz_information_sid,x.tf_002]), [['P',false],['C',false]]);
});

test('does not invent order ranges, renumber rows or impose an unverified single-default rule', () => {
  const out = review(input([
    row('ZERO', {display_order:0, is_display_default:true}),
    row('NEGATIVE', {display_order:-2, is_display_default:true}),
    row('DECIMAL', {display_order:1.25})
  ]));
  assert.deepEqual(out.proposal.save.map(x => x.num_001), [0,-2,1.25]);
  assert.deepEqual(out.proposal.save.map(x => x.tf_001), [true,true,false]);
  assert.equal(out.canApply, false);
});

test('missing and ambiguous values require review instead of coercing or supplying defaults', () => {
  const value = input([row('P', {display_order:'0', is_display_default:'false', display_tf:0}), {name:'legacy row'}]);
  const raw = JSON.stringify(value), out = reviewListTabSave(raw);
  assert.equal(out.proposal, null); assert.equal(out.status, 'review-required');
  assert.equal(out.diagnostics.length, 7); assert.deepEqual(out.snapshot, value); assert.equal(out.rawJson, raw);
});

test('duplicate IDs across parent and child require review without discarding either row', () => {
  const out = review(input([row('SAME', {children:[row('SAME')]})]));
  assert.equal(out.proposal, null);
  assert.ok(out.diagnostics.some(x => x.code === 'DUPLICATE_ID_REVIEW'));
  assert.equal(out.snapshot.tab_data[0].children[0].id, 'SAME');
  assert.equal(out.rows.length, 2);
});

test('absent, null and empty child arrays retain all parent settings', () => {
  const out = review(input([row('A'), row('B', {children:null}), row('C', {children:[]})]));
  assert.equal(out.proposal.save.length, 3); assert.deepEqual(out.diagnostics, []);
});

test('unknown child shapes and deeper nesting stay in the snapshot and block a proposal', () => {
  for (const children of [{legacy:'keep'}, [row('C', {children:[row('GRANDCHILD')]})]]) {
    const value = input([row('P', {children})]), out = review(value);
    assert.equal(out.proposal, null); assert.deepEqual(out.snapshot, value);
    assert.ok(out.diagnostics.some(x => ['CHILDREN_SHAPE','NESTING_REVIEW'].includes(x.code)));
  }
});

test('missing scope, empty tabs and unexpected root types never yield save data', () => {
  for (const value of [null, [], 'legacy', {}, {bizz_sid:'',tab_data:[row('P')]}, input([]), input([null])]) {
    const out = review(value);
    assert.equal(out.proposal, null); assert.equal(out.canApply, false); assert.equal(out.appIntegrated, false);
  }
});

test('nonfinite JSON numbers require review and the raw numeric text is retained', () => {
  const raw = '{"bizz_sid":"B","tab_data":[{"id":"P","display_order":1e999,"is_display_default":false,"display_tf":true}]}';
  const out = reviewListTabSave(raw);
  assert.equal(out.proposal, null); assert.equal(out.rawJson, raw);
  assert.ok(out.diagnostics.some(x => x.path.endsWith('.display_order')));
});

test('editing a proposal does not change retained source data or confer apply capability', () => {
  const out = review(input([row('P')])), retained = JSON.stringify(out.snapshot), raw = out.rawJson;
  out.proposal.save[0].num_001 = 50; out.rows[0].values.tf_002 = false;
  assert.equal(JSON.stringify(out.snapshot), retained); assert.equal(out.rawJson, raw);
  assert.equal(out.canApply, false); assert.equal(out.originalMenuMetadataVerified, false);
  assert.equal(out.originalPermissionAndPersistenceVerified, false);
});

test('requires a JSON string and rejects malformed JSON without interpreting it as code', () => {
  for (const raw of [null, {}, 42]) assert.throws(() => reviewListTabSave(raw), TypeError);
  for (const raw of ['{', 'undefined', 'process.exit()']) assert.throws(() => reviewListTabSave(raw), SyntaxError);
});
