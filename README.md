# build-personal-ai-assistant

从零构建个人 AI 助理 Harness 的实战教程。

本教程完整记录 [hachimi](https://github.com/ares0x/hachimi) 项目的设计与实现过程，帮助你理解如何打造一个**越用越懂你**的通用个人助理。

## 在线阅读

- 在线文档：[https://ares0x.github.io/build-personal-ai-assistant](https://ares0x.github.io/build-personal-ai-assistant)（部署后）
- 本仓库也可直接在 GitHub 阅读 Markdown

## 教程特色

- **实战导向**：每个阶段都有可运行的代码
- **设计思考**：不仅讲怎么做，更讲为什么这么做
- **取长补短**：融合 Pi、Claude Code 分析、Grok Build 的优秀设计
- **边做边写**：真实记录开发与重构过程

## 目录

0. [前言](docs/00-前言.md)
1. [项目定位与架构设计](docs/01-项目定位与架构设计.md)
2. [基础脚手架搭建](docs/02-基础脚手架搭建.md)
3. Phase 1：最小可用核心
4. Phase 2：分层 Memory
5. 交互式 CLI 与体验优化
6. 代码重构实践
7. 接入真实 LLM
8. Skills 系统
9. 持久化与 Session 管理
10. 多渠道支持
11. 权限、安全与可扩展性
12. 总结与后续演进

## 适合人群

- 想深入理解 Agent Harness 原理的开发者
- 想自己打造长期个人助理的人
- 熟悉 TypeScript，有一定工程经验的朋友

## 本地运行文档

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm docs:dev
