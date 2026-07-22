# hachimi Tutorial (build-personal-ai-assistant)

> **从零构建个人 AI 助理的硬核实战教程（重点讲解 Agent Harness 核心设计思想）**

本项目是面向个人助理场景的 **Agent Harness（控御大模型核心缰绳）** 实战开发教程。教程伴随配套主项目 [hachimi](https://github.com/ares0x/hachimi) 的开发演进过程，以逐步深入的方式从“零行代码”一步步构建出一个具有分层记忆、多渠道解耦、专业技能控制的极简 Agent Harness 演示 Demo。

> [!IMPORTANT]
> **版本与演进说明**：
> 1. 主实现项目 [hachimi](https://github.com/ares0x/hachimi) 的 **`tutorial` 分支** 对应当前 L1 阶段的全部代码实现。
> 2. `hachimi` 会持续系统化演进，本教程后续也会以新合集的形式持续更新，敬请期待！

---

## 📖 在线阅读

📚 **本教程已部署至 GitHub Pages，支持在线精美阅读**：
👉 [在线阅读地址](https://ares0x.github.io/build-personal-ai-assistant/)

---

## 🎯 教程定位

本项目**不是**一个教你调用外部 SDK 拼凑聊天框的玩具教程，而是一份**以软件架构、控制流设计和工程取舍为核心**的硬核开发手记。

通过阅读本教程，你将深入理解：
1. **为什么需要自研 Harness**：深刻剖析 LangChain、LlamaIndex 等重度抽象框架的隐性开销与心智负担。
2. **控制流循环设计 (Agent Loop)**：如何利用 `maxToolRounds` 设计健壮的 ReACT 多轮执行循环。
3. **分层记忆系统 (MemoryManager)**：学习 Working、Session、Long-term 三层物理隔离的记忆管理，以及无需重量级向量 DB 的启发式记忆检索算法。
4. **惰性技能装载 (Lazy Skills)**：如何通过仅将简短简介注入 System Prompt 的策略大幅节省 Token 开销，实现按需执行。
5. **通道层解耦**：设计扁平的 `IncomingMessage` 与 `OutgoingMessage` 通信契约，实现 Core Harness 与具体交互端（CLI / Telegram）的彻底分离。

---

## 🛠️ 技术栈

- **运行时 (Runtime)**: Node.js (版本 $\ge 20$)
- **包管理 (Workspace)**: `pnpm` (Monorepo)
- **开发语言**: TypeScript (严格 ESM 规范)
- **大模型驱动**: OpenAI Compatible API (OpenAI / DeepSeek / Ollama)
- **文档构建**: VitePress

---

## 🗂️ 目录大纲

- **00. [前言](docs/l1/00-前言.md)** - 背景介绍与心智心法
- **01. [项目定位与架构设计](docs/l1/01-项目定位与架构设计.md)** - 明确边界，解耦设计与 Mermaid 时序图
- **02. [基础脚手架搭建](docs/l1/02-基础脚手架搭建.md)** - 初始化 pnpm Monorepo 与严格的 TypeScript 编译配置
- **03. [最小可用核心](docs/l1/03-最小可用核心.md)** - MVP 闭环：基于正则匹配的 MockLLM 核心 ReACT 循环
- **04. [分层 Memory](docs/l1/04-分层Memory.md)** - Working / Session / Long-term 三层轻量级存储与启发式检索
- **05. [交互式 CLI](docs/l1/05-交互式CLI.md)** - 基于原生 readline 的控制台客户端与 Slash 指令拦截
- **06. [代码重构实践](docs/l1/06-代码重构实践.md)** - 处理 Workspace 依赖报错，抽取共享工具，对齐 ESM 相对路径
- **07. [接入真实 LLM](docs/l1/07-接入真实LLM.md)** - 零第三方 SDK 依赖，使用 fetch 封装支持 OpenAI 与 DeepSeek 协议
- **08. [Skills 系统](docs/l1/08-Skills系统.md)** - Lazy Skills 注册机制与 prompt 注入测试
- **09. [持久化与 Session 管理](docs/l1/09-持久化与Session管理.md)** - 本地多会话（Session）历史消息自动保存与跨进程恢复
- **10. [多渠道支持](docs/l1/10-多渠道支持.md)** - Channels 抽象，数据扁平流动协议设计与扩展点预留
- **11. [权限安全与可扩展性](docs/l1/11-权限安全与可扩展性.md)** - 安全边界防御：工具执行分级与人工审批流 (Requires Approval)
- **12. [总结与后续演进](docs/l1/12-总结与后续演进.md)** - 成果复盘与 L2 向量数据库、WASM 沙箱演进蓝图

---

## 💻 本地阅读运行

克隆项目后，你可以启动本地的 VitePress 开发服务器进行阅读或调试：

```bash
# 1. 安装项目所有多包依赖
pnpm install

# 2. 启动 VitePress 本地实时热更新预览
pnpm docs:dev
```

打开浏览器访问 `http://localhost:5173/` 即可。

---

## 🚀 部署发布

若需手动编译并构建静态文件：

```bash
pnpm docs:build
```

静态构建包将生成在 `docs/.vitepress/dist` 目录下。本仓库已配置 GitHub Actions 自动化部署，任何推送到 `main` 分支的提交都会自动部署至 GitHub Pages。
