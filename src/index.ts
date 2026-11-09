/** Pure AI API cost estimates. Rates are in one declared currency per `unit` tokens. */
export type Currency = 'USD' | 'CNY';
export interface Rates { input: number; output: number }
export interface Promotion extends Rates { label: string; startsAt?: string; endsAt?: string }
export interface PriceTier extends Rates { minInputTokens: number; promotion?: Promotion }
export interface TimeRate extends Rates {
  startTime: string; endTime: string; timeZone: string;
  /** 0 = Sunday; omitted or empty means every day. */
  weekdays?: number[];
  promotion?: Promotion;
}
export interface Price extends Rates {
  currency: Currency;
  /** Rate denominator. Defaults to 1,000,000 tokens. */
  unit?: number;
  promotion?: Promotion;
  tiers?: PriceTier[];
  timeRates?: TimeRate[];
}
export interface Usage { inputTokens: number; outputTokens: number }
export type PromotionStatus = 'none' | 'active' | 'upcoming' | 'expired';
export interface EffectivePrice extends Rates {
  regularInput: number; regularOutput: number;
  currency: Currency; unit: number;
  promotionStatus: PromotionStatus;
  promotionLabel?: string;
  source: 'base' | 'tier' | 'time';
  /** Zero-based index in the supplied tiers or timeRates, when selected. */
  ruleIndex?: number;
}
export interface CostEstimate {
  inputCost: number; outputCost: number; totalCost: number;
  currency: Currency; effectivePrice: EffectivePrice;
}
export const MAX_TOKENS = 1_000_000_000;
export const MAX_RATE = 100_000_000;

function fail(path: string, message: string): never { throw new RangeError(`${path}: ${message}`); }
function record(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
}
function finite(value: unknown, min: number, max: number, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(path, `must be a finite number between ${min} and ${max}`);
  }
}
function integer(value: unknown, min: number, max: number, path: string): asserts value is number {
  finite(value, min, max, path);
  if (!Number.isSafeInteger(value)) fail(path, 'must be a safe integer');
}
function currency(value: unknown, path: string): asserts value is Currency {
  if (value !== 'USD' && value !== 'CNY') fail(path, 'must be USD or CNY');
}
function rates(value: Record<string, unknown>, path: string): void {
  finite(value.input, 0, MAX_RATE, `${path}.input`);
  finite(value.output, 0, MAX_RATE, `${path}.output`);
}
function instant(value: unknown, path: string): number {
  if (typeof value !== 'string') fail(path, 'must be a timestamp string with a time zone');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) fail(path, 'use YYYY-MM-DDTHH:mm:ss[.SSS]Z or an explicit offset');
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! ||
      Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) fail(path, 'invalid calendar date or clock time');
  const result = Date.parse(value);
  if (!Number.isFinite(result)) fail(path, 'invalid timestamp or time-zone offset');
  return result;
}
function validatePromotion(value: unknown, regular: Record<string, unknown>, path: string): void {
  if (value === undefined) return;
  record(value, path); rates(value, path);
  if (typeof value.label !== 'string' || !value.label.trim() || value.label.length > 60) fail(`${path}.label`, 'must contain 1–60 characters');
  if (Number(value.input) > Number(regular.input) || Number(value.output) > Number(regular.output) ||
      value.input === regular.input && value.output === regular.output) fail(path, 'must reduce at least one rate and increase neither');
  const start = value.startsAt === undefined ? null : instant(value.startsAt, `${path}.startsAt`);
  const end = value.endsAt === undefined ? null : instant(value.endsAt, `${path}.endsAt`);
  if (start !== null && end !== null && start >= end) fail(path, 'endsAt must be after startsAt');
}
function clock(value: unknown, end: boolean, path: string): number {
  if (end && value === '24:00') return 1440;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(path, 'must be HH:mm (endTime also allows 24:00)');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function nowValue(now: number): void {
  finite(now, -8.64e15, 8.64e15, 'now');
  if (!Number.isInteger(now)) fail('now', 'must be integer epoch milliseconds');
}

/** Rejects invalid input, even when a malformed rule is currently inactive. */
export function validatePrice(value: unknown): asserts value is Price {
  record(value, 'price'); rates(value, 'price'); currency(value.currency, 'price.currency');
  if (value.unit !== undefined) integer(value.unit, 1, MAX_TOKENS, 'price.unit');
  validatePromotion(value.promotion, value, 'price.promotion');
  const tiers = value.tiers === undefined ? [] : value.tiers;
  const windows = value.timeRates === undefined ? [] : value.timeRates;
  if (!Array.isArray(tiers) || tiers.length > 20) fail('price.tiers', 'must be an array with at most 20 entries');
  if (!Array.isArray(windows) || windows.length > 24) fail('price.timeRates', 'must be an array with at most 24 entries');
  if (tiers.length && windows.length) fail('price', 'tiers and timeRates cannot be combined');
  let last = 0;
  for (const [index, tier] of tiers.entries()) {
    const path = `price.tiers[${index}]`;
    record(tier, path); rates(tier, path);
    integer(tier.minInputTokens, 1, MAX_TOKENS, `${path}.minInputTokens`);
    if (tier.minInputTokens <= last) fail(path, 'thresholds must be strictly increasing');
    last = tier.minInputTokens;
    validatePromotion(tier.promotion, tier, `${path}.promotion`);
  }
  let zone: string | undefined;
  const occupied: { start: number; end: number; days: number[] }[] = [];
  for (const [index, window] of windows.entries()) {
    const path = `price.timeRates[${index}]`;
    record(window, path); rates(window, path);
    const start = clock(window.startTime, false, `${path}.startTime`);
    const end = clock(window.endTime, true, `${path}.endTime`);
    if (start >= end) fail(path, 'use same-day windows with startTime before endTime; split overnight windows');
    if (typeof window.timeZone !== 'string' || !window.timeZone || /^[+-]/.test(window.timeZone)) fail(`${path}.timeZone`, 'must be a named IANA time zone');
    try { new Intl.DateTimeFormat('en-US', { timeZone: window.timeZone }); }
    catch { fail(`${path}.timeZone`, 'unsupported IANA time zone'); }
    if (zone !== undefined && zone !== window.timeZone) fail(path, 'all time windows must use the same timeZone');
    zone = window.timeZone;
    const rawDays = window.weekdays === undefined ? [] : window.weekdays;
    if (!Array.isArray(rawDays) || rawDays.length > 7) fail(`${path}.weekdays`, 'must be an array of distinct days 0–6');
    const days: number[] = [];
    for (const day of rawDays) {
      integer(day, 0, 6, `${path}.weekdays`);
      if (days.includes(day)) fail(`${path}.weekdays`, 'must not contain duplicates');
      days.push(day);
    }
    if (!days.length) days.push(0, 1, 2, 3, 4, 5, 6);
    if (occupied.some(other => start < other.end && other.start < end && days.some(day => other.days.includes(day)))) fail(path, 'time windows must not overlap on the same weekday');
    occupied.push({ start, end, days });
    validatePromotion(window.promotion, window, `${path}.promotion`);
  }
}

function status(promotion: Promotion | undefined, now: number): PromotionStatus {
  if (!promotion) return 'none';
  if (promotion.startsAt !== undefined && now < Date.parse(promotion.startsAt)) return 'upcoming';
  if (promotion.endsAt !== undefined && now >= Date.parse(promotion.endsAt)) return 'expired';
  return 'active';
}
function resolve(price: Price, inputTokens: number, now: number): EffectivePrice {
  let selected: Rates & { promotion?: Promotion } = price;
  let source: EffectivePrice['source'] = 'base';
  let ruleIndex: number | undefined;
  for (const [index, tier] of (price.tiers ?? []).entries()) {
    if (inputTokens >= tier.minInputTokens) { selected = tier; source = 'tier'; ruleIndex = index; }
  }
  if (price.timeRates?.length) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: price.timeRates[0]!.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(now));
    const get = (type: string): string => parts.find(part => part.type === type)?.value ?? '';
    const minute = Number(get('hour')) * 60 + Number(get('minute'));
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    for (const [index, window] of price.timeRates.entries()) {
      if ((!window.weekdays?.length || window.weekdays.includes(day)) && minute >= clock(window.startTime, false, 'startTime') && minute < clock(window.endTime, true, 'endTime')) {
        selected = window; source = 'time'; ruleIndex = index; break;
      }
    }
  }
  const promotionStatus = status(selected.promotion, now);
  const current = promotionStatus === 'active' ? selected.promotion! : selected;
  return {
    input: current.input, output: current.output,
    regularInput: selected.input, regularOutput: selected.output,
    currency: price.currency, unit: price.unit ?? 1_000_000, promotionStatus, source,
    ...(selected.promotion ? { promotionLabel: selected.promotion.label } : {}),
    ...(ruleIndex === undefined ? {} : { ruleIndex }),
  };
}

/** Whole-request tiers, then that rule's promotion. Explicit `now` makes results reproducible. */
export function effectivePrice(price: Price, inputTokens: number, now = Date.now()): EffectivePrice {
  validatePrice(price); integer(inputTokens, 0, MAX_TOKENS, 'inputTokens'); nowValue(now);
  return resolve(price, inputTokens, now);
}

/** Unrounded IEEE-754 estimate; this is not a settlement or invoice engine. */
export function estimateCost(price: Price, usage: Usage, now = Date.now()): CostEstimate {
  validatePrice(price); record(usage, 'usage');
  integer(usage.inputTokens, 0, MAX_TOKENS, 'usage.inputTokens');
  integer(usage.outputTokens, 0, MAX_TOKENS, 'usage.outputTokens'); nowValue(now);
  const resolved = resolve(price, usage.inputTokens, now);
  const inputCost = resolved.input * (usage.inputTokens / resolved.unit);
  const outputCost = resolved.output * (usage.outputTokens / resolved.unit);
  return { inputCost, outputCost, totalCost: inputCost + outputCost, currency: price.currency, effectivePrice: resolved };
}

/** Caller supplies USD→CNY rate; no network access or hidden rate lookup. */
export function convertCurrency(amount: number, from: Currency, to: Currency, usdCnyRate?: number): number {
  finite(amount, 0, Number.MAX_VALUE, 'amount'); currency(from, 'from'); currency(to, 'to');
  if (usdCnyRate !== undefined) finite(usdCnyRate, 0.000001, 1_000_000, 'usdCnyRate');
  if (from === to) return amount;
  finite(usdCnyRate, 0.000001, 1_000_000, 'usdCnyRate');
  const result = from === 'USD' ? amount * usdCnyRate : amount / usdCnyRate;
  if (!Number.isFinite(result)) fail('amount', 'currency conversion overflow');
  return result;
}
