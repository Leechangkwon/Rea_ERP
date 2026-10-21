"use strict";

// Research only. No UI/store imports, saved-document version or apply operation.
const ALGORITHM = "decimal29-divisor-order-v0";
const PRECISION = 29;
const RATES = new Set(["0", "3", "6", "7", "9", "10"]);
const pow10 = exponent => 10n ** BigInt(exponent);

function exactKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function parseSupply(value) {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,12})(\.\d{1,10})?$/.test(value))
    throw new Error("Supply must be a nonnegative decimal string with at most 10 decimal places");
  const [whole, fraction = ""] = value.split(".");
  const n = BigInt(whole + fraction), d = pow10(fraction.length);
  if (n > 1000000000000n * d) throw new Error("Supply exceeds the research bound");
  return { n, d };
}
function roundedQuotient(n, d, method) {
  const q = n / d, remainder = n % d;
  if (method === "ceil") return q + (remainder ? 1n : 0n);
  if (method === "round") return q + (remainder * 2n >= d ? 1n : 0n);
  return q;
}
function significant(n, d) {
  if (n === 0n) return { coefficient: 0n, scale: 0 };
  let exponent = n.toString().length - d.toString().length;
  if (exponent >= 0 ? n < d * pow10(exponent) : n * pow10(-exponent) < d) exponent--;
  const scale = PRECISION - 1 - exponent;
  const coefficient = scale >= 0
    ? roundedQuotient(n * pow10(scale), d, "round")
    : roundedQuotient(n, d * pow10(-scale), "round");
  return { coefficient, scale };
}
function fraction(decimal) {
  return decimal.scale >= 0
    ? { n: decimal.coefficient, d: pow10(decimal.scale) }
    : { n: decimal.coefficient * pow10(-decimal.scale), d: 1n };
}
function decimalText(coefficient, scale, fixed = false) {
  const negative = coefficient < 0n;
  let text = (negative ? -coefficient : coefficient).toString();
  if (scale <= 0) text += "0".repeat(-scale);
  else {
    text = text.padStart(scale + 1, "0");
    text = text.slice(0, -scale) + "." + text.slice(-scale);
    if (!fixed) text = text.replace(/0+$/, "").replace(/\.$/, "");
  }
  return (negative ? "-" : "") + text;
}
function previewVat(input) {
  if (!exactKeys(input, ["rawSupply", "vatRate", "rounding"])) throw new Error("Unsupported research input");
  const supply = parseSupply(input.rawSupply), rate = input.vatRate, policy = input.rounding;
  if (!RATES.has(rate)) throw new Error("Unreviewed VAT rate");
  if (!exactKeys(policy, ["method", "digits"]) || !["round", "floor", "ceil"].includes(policy.method) ||
      !Number.isInteger(policy.digits) || policy.digits < 0 || policy.digits > 2)
    throw new Error("Unsupported rounding policy");
  const divisor = rate === "0" ? null : significant(100n, BigInt(rate));
  const divided = divisor === null ? { coefficient: 0n, scale: 0 } : (() => {
    const ratio = fraction(divisor);
    return significant(supply.n * ratio.d, supply.d * ratio.n);
  })();
  const vatFraction = fraction(divided), scale = pow10(policy.digits);
  const vat = roundedQuotient(vatFraction.n * scale, vatFraction.d, policy.method);
  const exactVat = roundedQuotient(supply.n * BigInt(rate) * scale, supply.d * 100n, policy.method);
  return {
    algorithm: ALGORITHM, precision: PRECISION, canApply: false, persistenceVersion: null,
    originalRuntimeObserved: false, originalParityPassed: false,
    intermediate: { divisor: divisor === null ? null : decimalText(divisor.coefficient, divisor.scale),
      vatBeforeFormat: decimalText(divided.coefficient, divided.scale) },
    amounts: { vat: decimalText(vat, policy.digits, true), exactRationalVat: decimalText(exactVat, policy.digits, true),
      delta: decimalText(vat - exactVat, policy.digits, true) },
  };
}
module.exports = { ALGORITHM, previewVat };
