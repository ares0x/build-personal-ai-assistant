# build-personal-ai-assistant

从零构建个人 AI 助理的实战教程（重点讲解 Agent Harness 核心设计思想）。

本教程记录了我在开发个人 AI 助理 [hachimi](https://github.com/ares0x/hachimi) 过程中，对 **Agent Harness** 的设计与实现思考。

它不是一个直接可用的生产级产品教程，而是一份**以架构和设计思想为核心**的学习型实战记录。

## 在线阅读

- 在线文档：https://ares0x.github.io/build-personal-ai-assistant/

## 教程定位

我正在开发一款属于自己的个人 AI 助理（hachimi）。

在这个过程中，我把底层最关键的部分——**Harness（缰绳）**的设计与实现过程整理成了这份教程。

本教程重点讲解：

- 为什么需要自己做 Harness
- 如何设计清晰、可扩展的 Agent 核心架构
- 分层 Memory、Tool、Skills、权限等关键模块的设计思路
- 如何从最小可运行版本逐步演进

它适合想深入理解 Agent 底层原理，并希望自己动手实现一个可扩展 Harness 的开发者。

## 你能获得什么

- 一个结构清晰的 Agent Harness 参考实现
- 对 Pi、Claude Code、Grok Build 等优秀项目的设计取舍分析
- 从零到可运行 Demo 的完整实战路径
- 可继续扩展成真正个人助理的基础架构

## 目录

0. [前言](docs/00-前言.md)
1. [项目定位与架构设计](docs/01-项目定位与架构设计.md)
2. [基础脚手架搭建](docs/02-基础脚手架搭建.md)
3.[最小可用核心](docs/03-最小可用核心.md)
4. [分层 Memory](docs/04-分层Memory.md)
5. [交互式 CLI 与体验优化](docs/05-交互式CLI.md)
6. [代码重构实践](docs/06-代码重构实践.md)
7. [接入真实 LLM](docs/07-接入真实LLM.md)
8.[ Skills 系统](docs/08-Skills系统.md)
9. [持久化与 Session 管理](docs/09-持久化与Session管理.md)
10. [多渠道支持](docs/10-多渠道支持.md)
11. [权限、安全与可扩展性](docs/11-权限安全与可扩展性.md)
12. [总结与后续演进](docs/12-总结与后续演进.md)

## 本地运行

```bash
pnpm install
pnpm docs:dev
```
