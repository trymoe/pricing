import { estimateCost, convertCurrency } from './core.js';
const $ = id => document.getElementById(id);
const base = { currency: 'USD', unit: 1_000_000, input: 2, output: 8 };
const scenarios = {
  base,
  tier: { ...base, tiers: [{ minInputTokens: 200_000, input: 3, output: 12 }] },
  promotion: { ...base, promotion: { label: '合成限时优惠', input: 1, output: 4, startsAt: '2026-06-01T00:00:00Z', endsAt: '2026-06-02T00:00:00Z' } },
  time: { ...base, timeRates: [{ startTime: '09:00', endTime: '17:00', timeZone: 'Asia/Shanghai', weekdays: [1,2,3,4,5], input: 4, output: 12 }] },
};
const labels = { base: '基础报价', tier: '整次请求 · 长上下文档', time: '上海工作日 · 峰值时段' };
const statuses = { none: '无优惠', active: '已生效', upcoming: '尚未开始', expired: '已结束，使用常规价' };
const numeric = id => {
  if (!$(id).value.trim()) throw new RangeError('请填写完整的用量和汇率。');
  return Number($(id).value);
};
function render() {
  const price = scenarios[$('scenario').value];
  $('quote').textContent = JSON.stringify(price, null, 2);
  try {
    if (!$('time').value) throw new RangeError('请选择计算时间（UTC）。');
    const estimate = estimateCost(price, { inputTokens: numeric('input'), outputTokens: numeric('output') }, Date.parse(`${$('time').value}Z`));
    const currency = $('currency').value, rate = numeric('fx');
    const convert = value => convertCurrency(value, 'USD', currency, rate);
    const format = value => convert(value).toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    $('symbol').textContent = currency === 'USD' ? '$' : '¥'; $('unit').textContent = currency;
    $('total').textContent = format(estimate.totalCost);
    $('input-cost').textContent = `${format(estimate.inputCost)} ${currency}`;
    $('output-cost').textContent = `${format(estimate.outputCost)} ${currency}`;
    $('rates').textContent = `${estimate.effectivePrice.input} / ${estimate.effectivePrice.output} USD`;
    $('selected').textContent = labels[estimate.effectivePrice.source];
    $('promo-status').textContent = statuses[estimate.effectivePrice.promotionStatus];
    $('formula').textContent = `${numeric('input').toLocaleString('en-US')} × ${estimate.effectivePrice.input} ÷ 1,000,000 + ${numeric('output').toLocaleString('en-US')} × ${estimate.effectivePrice.output} ÷ 1,000,000 = ${estimate.totalCost} USD`;
    $('json').textContent = JSON.stringify({ ...estimate, displayedCurrency: currency, convertedTotal: convert(estimate.totalCost), syntheticUsdCnyRate: rate }, null, 2);
    $('error').hidden = true; $('result').hidden = false;
  } catch (error) {
    $('error').textContent = `无法估算：${error.message}`; $('error').hidden = false; $('result').hidden = true;
    $('json').textContent = '输入无效，未生成估算结果。';
  }
}
$('calculator').addEventListener('input', render);
$('calculator').addEventListener('change', render);
$('calculator').addEventListener('submit', event => event.preventDefault());
$('reset-demo').addEventListener('click', () => { $('calculator').reset(); render(); });
render();
