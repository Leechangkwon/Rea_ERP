"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { previewVat } = require("../scripts/lib/transaction-vat-decimal-candidate.cjs");
const examples = require("./fixtures/transaction-vat-decimal-examples.json");
const input = (rawSupply = "1000", vatRate = "7", method = "floor", digits = 0) => ({ rawSupply, vatRate, rounding: { method, digits } });
for (const example of examples.cases) test(`29 significant-digit divisor order at ${example.rate} percent`, () => {
  const result = previewVat(input("1000", example.rate));
  assert.deepEqual(result.intermediate, { divisor: example.divisor, vatBeforeFormat: example.before });
  assert.equal(result.amounts.vat, example.floor);
});
test("7 percent floor differs from exact multiplication while round/ceil do not", () => {
  assert.deepEqual(previewVat(input()).amounts, { vat: "69", exactRationalVat: "70", delta: "-1" });
  for (const method of ["round", "ceil"]) assert.equal(previewVat(input("1000", "7", method)).amounts.vat, "70");
});
test("decimal precision boundary retains the divisor operation error", () => {
  assert.deepEqual(previewVat(input("1", "7", "floor", 2)).amounts, { vat: "0.06", exactRationalVat: "0.07", delta: "-0.01" });
  assert.equal(previewVat(input("0.05", "10", "round", 2)).amounts.vat, "0.01");
  assert.equal(previewVat(input("0.0499999999", "10", "round", 2)).amounts.vat, "0.00");
});
test("zero rate and zero supply never divide by zero", () => {
  assert.equal(previewVat(input("1000", "0")).intermediate.divisor, null);
  for (const rate of ["0", "3", "6", "7", "9", "10"]) assert.equal(previewVat(input("0", rate)).amounts.vat, "0");
});
test("supported research bounds are exact", () => {
  assert.equal(previewVat(input("1000000000000.0000000000", "10")).amounts.vat, "100000000000");
  assert.equal(previewVat(input("0.0000000001", "7", "ceil", 2)).amounts.vat, "0.01");
  assert.throws(() => previewVat(input("1000000000000.0000000001")), /bound/);
});
test("rejects unsupported numbers, signs, precision and spellings", () => {
  for (const supply of [1, NaN, Infinity, "-1", "+1", "01", "1e2", " 1", "1.", "0.00000000001", "", null])
    assert.throws(() => previewVat(input(supply)));
  for (const rate of [7, "7.0", "5", "100", "-7", null]) assert.throws(() => previewVat(input("1", rate)));
});
test("rejects unknown policy and extra input instead of inferring rules", () => {
  for (const value of [null, [], {}, {...input(), currency: "KRW"}, {...input(), rounding: {method:"floor",digits:0,extra:true}}, input("1","7","bankers"), input("1","7","floor",3), input("1","7","floor",0.5)])
    assert.throws(() => previewVat(value));
});
test("immutable input and never an applicable saved-document calculation", () => {
  const value = input(); Object.freeze(value.rounding); Object.freeze(value);
  const before = JSON.stringify(value), result = previewVat(value);
  assert.equal(JSON.stringify(value), before); assert.equal(result.algorithm, "decimal29-divisor-order-v0");
  assert.equal(result.canApply, false); assert.equal(result.persistenceVersion, null);
  assert.equal(result.originalRuntimeObserved, false); assert.equal(result.originalParityPassed, false);
});
