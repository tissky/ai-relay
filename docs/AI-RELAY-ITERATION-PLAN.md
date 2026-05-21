# AI Relay 后续功能迭代 — 圆桌讨论结论

## 基本信息
- **讨论 ID**: rt_468775a4
- **主题**: 以 Vercel Serverless 模式开发部署的 AI Relay 后续功能迭代
- **日期**: 2026-05-21
- **轮次**: 4 轮
- **参与者**: 饼哥（产品总监）、像素姐（设计总监）、码飞（技术总监）、小赫（协调者）

## 项目定位（Boss 确认）
**个人版本轻量化后台，后续稳定后开源。**
- 不需要商业化/计费/Stripe 等运营功能
- 面向个人开发者和小团队
- 核心价值：轻量、易部署、开源友好

## 信心指数
**8/10**（全员一致）

## 核心结论

### 产品定位
- 面向个人开发者和小团队的轻量化 AI API 中转站
- 核心价值：**省心** — 统一接口、Key 池化、用量可视化
- 后续稳定后开源，不需要商业化考量

### 3-Sprint 迭代计划（调整版）

| Sprint | 时间 | 核心交付 |
|--------|------|---------|
| S0 | 本周 | 仓库重构 + Drizzle ORM + 埋点 SDK + 前置设计 |
| S1 | Month 1 | Streaming P0 + 用户体系（Clerk）+ KV 埋点 |
| S2 | Month 2 | 权限 MVP + Postgres Schema + 双写验证 + Dashboard 增强 |
| S3 | Month 3 | 灰度切换 + 用量配额 + 公开 Metrics + 开源准备 |

> ~~S4 Stripe + 计费~~ 已移除 — 不需要商业化功能

### 共识点
1. **用户体系是进化的基础** — Clerk 集成，Owner + Member 两级
2. **智能路由是核心差异化** — 滑动窗口 + 熔断降级
3. **Streaming 升 P0** — AI 体验底线 + Edge 原生 SSE 支持
4. **Day 1 埋计量** — KV INCR 免费档够用
5. **Postgres 提前设计** — Month 1 Schema，按需引入
6. **Dashboard 分层** — Hero Metrics → 趋势层 → 明细层

### Top 3 行动项
1. 🔴 **Streaming 重构** — Edge SSE Proxy 模式
2. 🔴 **计量埋点 SDK** — 10 字段规范，Day 1 就埋
3. 🔴 **Postgres Schema 设计** — 6 张核心表 + Migration

### 风险管理
- **S2 是最高风险 Sprint** — KV→Postgres 灰度切换
- **缓解方案**: S1 提前启动双写验证 + Shadow Testing + Feature Flag 随时回滚

## 技术架构决策

### Postgres Schema（6 张核心表）
1. `users` — 用户表
2. `organizations` — 组织表
3. `org_members` — 组织成员关系
4. `api_keys` — API Key 管理
5. `request_logs` — 请求日志（预留月分区）
6. `usage_quotas` — 用量配额

### 代码重构优先级
- P0: 错误处理规范化 + Provider 类型统一
- P1: Key 轮转算法
- P2: 中间件链抽取

### Dashboard 设计
- **三层架构**: Hero Metrics（一眼健康）→ 趋势层（发现问题）→ 明细层（定位问题）
- **权限 MVP**: Owner + Member 两级

## 开源准备（S3）
- [ ] README 完善（中英文）
- [ ] 部署文档（Vercel 一键部署按钮）
- [ ] 环境变量文档
- [ ] Provider 扩展指南
- [ ] License 选择
- [ ] Contribution Guide

## 金句
> 「AI Relay 不是在造一个产品，而是在造一台会自己长大的引擎——架构对了，数据通了，剩下的交给时间。」— 码飞

---

*本文档由圆桌讨论自动生成，讨论 ID: rt_468775a4*
*项目定位已根据 Boss 反馈调整：个人版轻量化后台，后续开源，不考虑商业化*
