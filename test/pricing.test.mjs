import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectivePrice, estimateCost, convertCurrency, validatePrice, MAX_TOKENS, MAX_RATE } from '../dist/index.js';
const at = value => Date.parse(value);
const now = at('2026-06-01T12:00:00Z');
const base = { input: 2, output: 8, currency: 'USD' };
const usage = { inputTokens: 1_000_000, outputTokens: 100_000 };
const promotion = { label: 'Synthetic sale', input: 1, output: 4, startsAt: '2026-06-01T12:00:00Z', endsAt: '2026-06-02T12:00:00Z' };
const window = { input: 1, output: 3, startTime: '09:00', endTime: '17:00', timeZone: 'Asia/Shanghai' };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('input and output costs, defaults and explicit denominator', () => {
  const result = estimateCost(base, usage, now);
  assert.deepEqual(result, { inputCost: 2, outputCost: 0.8, totalCost: 2.8, currency: 'USD', effectivePrice: {
    input: 2, output: 8, regularInput: 2, regularOutput: 8, currency: 'USD', unit: 1_000_000, promotionStatus: 'none', source: 'base',
  } });
  assert.equal(estimateCost({ ...base, unit: 1000 }, { inputTokens: 1000, outputTokens: 1000 }, now).totalCost, 10);
  assert.equal(estimateCost(base, { inputTokens: 0, outputTokens: 0 }, now).totalCost, 0);
  assert.equal(estimateCost({ ...base, input: 0, output: 0 }, usage, now).totalCost, 0);
});
test('promotion boundaries are start-inclusive and end-exclusive', () => {
  const price = { ...base, promotion };
  for (const [time, status, input] of [[now - 1, 'upcoming', 2], [now, 'active', 1], [now + 86_400_000 - 1, 'active', 1], [now + 86_400_000, 'expired', 2]]) {
    const result = effectivePrice(price, 1, time);
    assert.equal(result.promotionStatus, status); assert.equal(result.input, input); assert.equal(result.regularInput, 2);
  }
});
test('open-ended and zero-price promotions', () => {
  const price = { ...base, promotion: { label: 'Synthetic free period', input: 0, output: 0 } };
  assert.equal(estimateCost(price, usage, now).totalCost, 0);
  assert.equal(effectivePrice({ ...base, promotion: { ...promotion, startsAt: undefined } }, 1, now).input, 1);
  assert.equal(effectivePrice({ ...base, promotion: { ...promotion, endsAt: undefined } }, 1, now).input, 1);
});
test('explicit timestamp offsets and milliseconds', () => {
  const price = { ...base, promotion: { ...promotion, startsAt: '2026-06-01T20:00:00.001+08:00' } };
  assert.equal(effectivePrice(price, 1, now).promotionStatus, 'upcoming');
  assert.equal(effectivePrice(price, 1, now + 1).promotionStatus, 'active');
});
test('whole-request context tiers, not marginal blocks', () => {
  const price = { ...base, tiers: [{ minInputTokens: 100_000, input: 3, output: 10 }, { minInputTokens: 200_000, input: 5, output: 12 }] };
  for (const [tokens, input, source, index] of [[99_999, 2, 'base', undefined], [100_000, 3, 'tier', 0], [199_999, 3, 'tier', 0], [200_000, 5, 'tier', 1]]) {
    const rate = effectivePrice(price, tokens, now);
    assert.equal(rate.input, input); assert.equal(rate.source, source); assert.equal(rate.ruleIndex, index);
  }
  assert.equal(estimateCost(price, { inputTokens: 200_000, outputTokens: 0 }, now).totalCost, 1);
});
test('selected tier owns its promotion; base promotion does not leak', () => {
  const price = { ...base, promotion, tiers: [{ minInputTokens: 100, input: 5, output: 20 }] };
  assert.equal(effectivePrice(price, 99, now).input, 1);
  assert.equal(effectivePrice(price, 100, now).input, 5);
  assert.equal(effectivePrice(price, 100, now).promotionStatus, 'none');
  price.tiers[0].promotion = { label: 'Synthetic tier sale', input: 3, output: 15 };
  assert.equal(effectivePrice(price, 100, now).input, 3);
});
test('time zones and clock boundaries', () => {
  const price = { ...base, timeRates: [window] };
  for (const [time, input] of [['2026-06-01T00:59:59Z', 2], ['2026-06-01T01:00:00Z', 1], ['2026-06-01T08:59:59Z', 1], ['2026-06-01T09:00:00Z', 2]]) assert.equal(effectivePrice(price, 1, at(time)).input, input);
});
test('weekdays use local day, Sunday=0, empty means every day', () => {
  const w = { ...window, startTime: '00:00', endTime: '24:00', weekdays: [1] };
  const price = { ...base, timeRates: [w] };
  assert.equal(effectivePrice(price, 1, at('2026-05-31T16:00:00Z')).input, 1);
  assert.equal(effectivePrice(price, 1, at('2026-06-01T16:00:00Z')).input, 2);
  w.weekdays = [0]; assert.equal(effectivePrice(price, 1, at('2026-05-31T00:00:00Z')).input, 1);
  w.weekdays = []; assert.equal(effectivePrice(price, 1, now).input, 1);
});
test('24:00 and adjacent windows are unambiguous', () => {
  const price = { ...base, timeRates: [
    { ...window, startTime: '00:00', endTime: '12:00' },
    { ...window, input: 4, startTime: '12:00', endTime: '24:00' },
  ] };
  assert.equal(effectivePrice(price, 1, at('2026-06-01T04:00:00Z')).input, 4);
  assert.equal(effectivePrice(price, 1, at('2026-06-01T16:00:00Z')).input, 1);
});
test('DST spring gap and fall repeat use the actual local wall clock', () => {
  const price = { ...base, timeRates: [{ ...window, timeZone: 'America/New_York', startTime: '01:00', endTime: '02:00' }] };
  assert.equal(effectivePrice(price, 1, at('2026-03-08T06:59:59Z')).input, 1);
  assert.equal(effectivePrice(price, 1, at('2026-03-08T07:00:00Z')).input, 2);
  assert.equal(effectivePrice(price, 1, at('2026-11-01T05:30:00Z')).input, 1);
  assert.equal(effectivePrice(price, 1, at('2026-11-01T06:30:00Z')).input, 1);
});
test('time rule owns promotion and restores regular time rate at expiry', () => {
  const price = { ...base, promotion, timeRates: [{ ...window, startTime: '00:00', endTime: '24:00', promotion: { label: 'Synthetic window sale', input: 0, output: 0, endsAt: promotion.endsAt } }] };
  assert.equal(effectivePrice(price, 1, now).input, 0);
  assert.equal(effectivePrice(price, 1, now + 86_400_000).input, 1);
  assert.equal(effectivePrice(price, 1, now + 86_400_000).promotionStatus, 'expired');
});
test('USD/CNY conversion is explicit and reversible within float tolerance', () => {
  assert.equal(convertCurrency(2, 'USD', 'CNY', 7), 14);
  assert.equal(convertCurrency(14, 'CNY', 'USD', 7), 2);
  assert.equal(convertCurrency(2, 'USD', 'USD'), 2);
  assert.equal(convertCurrency(0, 'USD', 'CNY', 7), 0);
  for (const amount of [0.1, 100, 1234.567]) close(convertCurrency(convertCurrency(amount, 'USD', 'CNY', 7.123), 'CNY', 'USD', 7.123), amount);
  for (const args of [[2,'USD','CNY'],[-1,'USD','CNY',7],[2,'EUR','USD',7],[2,'USD','CNY',0],[2,'USD','CNY',Infinity],[Number.MAX_VALUE,'USD','CNY',2],[2,'USD','USD',NaN]]) assert.throws(() => convertCurrency(...args), RangeError);
});
const invalid = [
  null, [], {}, { ...base, input: NaN }, { ...base, output: Infinity }, { ...base, input: -1 }, { ...base, input: MAX_RATE + 1 },
  { ...base, input: '2' }, { ...base, currency: 'EUR' }, { ...base, unit: 0 }, { ...base, unit: 1.5 },
  { ...base, promotion: null }, { ...base, promotion: { ...promotion, label: '' } },
  { ...base, promotion: { ...promotion, input: 3 } }, { ...base, promotion: { ...promotion, input: 2, output: 8 } },
  { ...base, promotion: { ...promotion, startsAt: '2026-06-01' } }, { ...base, promotion: { ...promotion, startsAt: '2026-06-01T12:00:00' } },
  { ...base, promotion: { ...promotion, startsAt: '2026-02-30T00:00:00Z' } }, { ...base, promotion: { ...promotion, startsAt: '2026-02-29T00:00:00Z' } },
  { ...base, promotion: { ...promotion, startsAt: '2026-06-01T24:00:00Z' } }, { ...base, promotion: { ...promotion, endsAt: promotion.startsAt } },
  { ...base, tiers: {} }, { ...base, tiers: [null] }, { ...base, tiers: [{ input: 1, output: 1, minInputTokens: 0 }] },
  { ...base, tiers: [{ input: 1, output: 1, minInputTokens: 2 }, { input: 1, output: 1, minInputTokens: 1 }] },
  { ...base, tiers: [{ input: 1, output: 1, minInputTokens: 2 }, { input: 1, output: 1, minInputTokens: 2 }] },
  { ...base, tiers: [{ input: 1, output: 1, minInputTokens: 2 }], timeRates: [window] },
  { ...base, timeRates: [window, window] }, { ...base, timeRates: null },
  ...[{ timeZone: 'Wrong/Zone' }, { timeZone: '+08:00' }, { startTime: '17:00', endTime: '09:00' }, { startTime: '9:00' }, { endTime: '24:01' }, { weekdays: [7] }, { weekdays: [1, 1] }, { weekdays: [0.5] }, { weekdays: null }].map(change => ({ ...base, timeRates: [{ ...window, ...change }] })),
  { ...base, timeRates: [window, { ...window, timeZone: 'UTC', startTime: '18:00', endTime: '19:00' }] },
  { ...base, tiers: Array.from({length:21}, (_, index) => ({ input: 1, output: 1, minInputTokens: index + 1 })) },
  { ...base, timeRates: Array.from({length:25}, () => window) },
];
for (const [index, price] of invalid.entries()) test(`reject malformed price #${index + 1}`, () => assert.throws(() => validatePrice(price), RangeError));
test('invalid usage and time fail rather than imply a free request', () => {
  for (const tokens of [-1, 0.5, NaN, Infinity, MAX_TOKENS + 1, '100']) {
    assert.throws(() => estimateCost(base, { inputTokens: tokens, outputTokens: 0 }, now), RangeError);
    assert.throws(() => estimateCost(base, { inputTokens: 0, outputTokens: tokens }, now), RangeError);
  }
  assert.throws(() => estimateCost(base, null, now), RangeError);
  for (const time of [NaN, Infinity, 8.64e15 + 1, 0.5, '2026-06-01']) assert.throws(() => effectivePrice(base, 1, time), RangeError);
});
test('validate inactive rules and reject holes', () => {
  assert.throws(() => effectivePrice({ ...base, tiers: [{ input: -1, output: 0, minInputTokens: 100 }] }, 0, now), RangeError);
  assert.throws(() => validatePrice({ ...base, tiers: Array(1) }), RangeError);
  assert.throws(() => validatePrice({ ...base, timeRates: Array(1) }), RangeError);
});
test('disjoint weekdays and leap day are valid', () => {
  validatePrice({ ...base, timeRates: [{ ...window, weekdays: [0] }, { ...window, weekdays: [1] }] });
  validatePrice({ ...base, promotion: { ...promotion, startsAt: '2024-02-29T00:00:00Z' } });
});
test('does not mutate caller data or expose nested references', () => {
  const price = { ...base, timeRates: [{ ...window, weekdays: [1, 2] }] };
  const original = structuredClone(price);
  Object.freeze(price.timeRates[0].weekdays); Object.freeze(price.timeRates[0]); Object.freeze(price.timeRates); Object.freeze(price);
  const result = estimateCost(price, usage, now); result.effectivePrice.input = 999;
  assert.deepEqual(price, original);
});
test('deterministic synthetic property sweep: linearity and denominator normalization', () => {
  let seed = 123456;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let index = 0; index < 1000; index++) {
    const price = { input: random() * 100, output: random() * 100, currency: 'USD' };
    const use = { inputTokens: Math.floor(random() * 1e6), outputTokens: Math.floor(random() * 1e6) };
    const result = estimateCost(price, use, now);
    assert.ok(Number.isFinite(result.totalCost) && result.totalCost >= 0);
    close(result.totalCost, result.inputCost + result.outputCost);
    close(estimateCost(price, { inputTokens: use.inputTokens * 2, outputTokens: use.outputTokens * 2 }, now).totalCost, 2 * result.totalCost);
    close(estimateCost({ ...price, input: price.input / 1000, output: price.output / 1000, unit: 1000 }, use, now).totalCost, result.totalCost);
  }
});
