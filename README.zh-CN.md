# TryMoe Pricing

一个用于 **AI API Token 费用估算**的独立 TypeScript 核心，从 [萌测 TryMoe](https://try.moe/) 的纯计算逻辑抽取并增加严格校验。运行时零依赖，不访问网络。

[English](README.md) · [计价口径](docs/semantics.md) · [MIT 许可](LICENSE)

支持输入/输出费用、限时优惠、整次请求的长上下文分档、IANA 时区与星期限制、峰谷时段，以及调用方提供汇率的 USD/CNY 换算。

**这是估算器，不是账单结算器。** 示例与演示全部使用合成价格，未包含真实供应商报价库、生产数据、后台、监控或用户资料。最新有来源报价请到 [TryMoe](https://try.moe/) 核对。

## 运行

需要 Node.js 22+（完整 ICU 时区支持）、npm 和 Git。

```sh
git clone https://github.com/trymoe/pricing.git trymoe-pricing
cd trymoe-pricing
npm ci
npm run check
node examples/basic.mjs
npm run demo
```

打开 `http://127.0.0.1:4178`。演示直接在浏览器计算，不发送你填写的数值。`npm run demo:build` 会生成可部署到静态主机的 `site/` 目录。

`npm pack` 可生成本地安装包。此文档不表示已经发布到 npm 注册表。

## 示例

```ts
import { estimateCost } from './dist/index.js';

const result = estimateCost(
  { currency: 'USD', input: 2, output: 8, unit: 1_000_000 },
  { inputTokens: 1_000_000, outputTokens: 100_000 },
  Date.parse('2026-06-01T12:00:00Z'),
);
// 输入费用 2，输出费用 0.8，总计 2.8 USD，均为未舍入估算值。
```

`effectivePrice` 返回选中单价、常规单价、优惠状态和规则下标；`validatePrice` 可校验外部 JSON，错误抛出带字段路径的 `RangeError`。完整 API 见 TypeScript 声明和[计价口径](docs/semantics.md)。

## 关键口径

- 输入量选择整次请求的分档，不是超出阈值部分才加价。选中档同时确定输入和输出单价。
- 分档和时段不能混配。选中规则只使用自己的优惠，不继承基础优惠。
- 优惠开始时刻包含、结束时刻不包含；未填截止时间不等于永久有效。
- 时段必须同一天、同一 IANA 时区、不重叠；跨午夜拆成两段。星期以报价时区为准，周日是 0。
- 明确传入时间才能复现历史结果。金额使用 JavaScript 浮点数，不做账单舍入。
- 输入和输出各最多 10 亿 Token，最多 20 个分档或 24 个时段。无效规则即使当前未生效也会拒绝。

不覆盖缓存、工具、批处理、图片/音视频、充值、税费、订阅、最低消费等费用，也不判断供应商可信度和模型真实性。实际账单以服务商规则为准。

## 许可与贡献

代码和文档采用 MIT；不连带授权第三方报价、商标或整个 TryMoe 网站。开发依赖的许可单独列于[依赖说明](docs/third-party-notices.md)。

欢迎附可复现合成样例与边界测试的修正。请勿在 Issue、PR 或测试文件中提交 API Key、个人资料、真实账单或生产配置。
