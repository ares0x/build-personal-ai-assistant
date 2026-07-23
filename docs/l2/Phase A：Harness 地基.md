---
title: L2 Phase A. Harness 地基重构与测试
description: 本章讲解 hachimi 从实验脚本向可维护运行时的重构过程，详细涵盖配置统一、存储解耦、上下文独立组装、工具权限设计与 Vitest 自动化单元测试。
keywords: L2 地基重构, Config 模块, Storage 协议, ContextBuilder, 工具权限, 单元测试, TUI
---

# Phase A：Harness 地基

## 本章目标

在 L1 阶段，我们成功使用极简的原生代码验证了 Agent 核心循环、分层 Memory 记忆、交互式 CLI 以及 OpenAI 兼容 Provider。然而，L1 仅仅是一个验证概念（POC）的 Demo：所有的配置散落在 `env` 中，存储直接读写文件系统（不利于单元测试），System Prompt 的拼装逻辑与 Agent 主体高度耦合，难以维护。

进入 L2 阶段的第一部分（**Phase A：Harness 地基**），我们的核心目标是将 L1 阶段的实验代码升级为**模块清晰、高可维护、高可观测的运行时基座**。

本章我们实现以下系统化升级：
- **配置统一管理**：引入 `@hachimi/config` 模块，规范配置优先级。
- **存储介质解耦**：引入 `@hachimi/storage` 存储协议层，支持依赖注入。
- **上下文解耦组装**：剥离 Agent 提示词拼接，引入 `ContextBuilder` 独立单元。
- **工具权限初步拦截**：引入工具风险分级属性（`permission`）与执行阻断逻辑。
- **技能按需动态加载**：实现对用户“使用某技能”意图的捕获，动态加载完整指令（On-demand Loading）。
- **Vitest 单元测试覆盖**：搭建测试基座，保障 Agent 核心循环的安全重构。
- **稳定 TUI Readline 通道**：搭建基于 AppContext 全局组装的稳定 Readline 对话终端。

---

## 1. 统一 Config 模块设计

**为什么**：在 L1 阶段，我们到处都在使用 `process.env.DEEPSEEK_API_KEY` 或 `process.env.LLM_PROVIDER`。这种散落的环境变量获取导致：
- 很难给某些参数（如 `maxToolRounds`）提供默认值。
- 在编写单元测试时，无法优雅地 Mock 配置。
- 无法使用结构化的配置文件（如 `config.json`）。

**实现方案**：我们新建子包 `packages/config`，统一管理全局配置。

### 接口与默认配置 (`packages/config/src/index.ts`)

```ts
export type LLMProviderName = "mock" | "openai" | "deepseek";

export interface HachimiConfig {
  llm: {
    provider: LLMProviderName;
    openaiApiKey?: string;
    openaiModel: string;
    deepseekApiKey?: string;
    deepseekModel: string;
    deepseekBaseURL: string;
  };
  paths: {
    dataDir: string;
    memoryFile: string;
    sessionsDir: string;
  };
  agent: {
    maxToolRounds: number;
  };
  tui: {
    title: string;
  };
}

const defaultConfig: HachimiConfig = {
  llm: {
    provider: (process.env.LLM_PROVIDER as LLMProviderName) || "mock",
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    deepseekBaseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  },
  paths: {
    dataDir: process.env.HACHIMI_DATA_DIR || resolve("data"),
    memoryFile: process.env.HACHIMI_MEMORY_FILE || resolve("data/memory.json"),
    sessionsDir: process.env.HACHIMI_SESSIONS_DIR || resolve("data/sessions"),
  },
  agent: {
    maxToolRounds: Number(process.env.HACHIMI_MAX_TOOL_ROUNDS || 5),
  },
  tui: {
    title: "hachimi",
  },
};
```

### 优先级加载逻辑

我们通过 `loadConfig` 方法暴露配置，遵循如下载入优先级：
$$\text{defaultConfig (默认值)} \quad < \quad \text{config.json (配置文件)} \quad < \quad \text{process.env (环境变量)}$$

```ts
export function loadConfig(configPath = "config.json"): HachimiConfig {
  const cfg: HachimiConfig = structuredClone(defaultConfig);

  // 如果本地存在 config.json，则合并覆盖默认值
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      Object.assign(cfg.llm, raw.llm ?? {});
      Object.assign(cfg.paths, raw.paths ?? {});
      Object.assign(cfg.agent, raw.agent ?? {});
      Object.assign(cfg.tui, raw.tui ?? {});
    } catch (err) {
      console.warn("[config] 读取 config.json 失败，使用默认配置", err);
    }
  }
  return cfg;
}
```

---

## 2. Storage 介质解耦

**为什么**：在 L1 中，`MemoryManager` 和 `SessionManager` 直接调用了 Node.js 原生的 `readFileSync` 与 `writeFileSync`。这使得我们：
- 在运行单元测试时，测试用例会直接在物理磁盘写文件，产生副作用，很难维持干净的测试沙箱。
- 未来想要将文件存储升级为数据库存储（如 SQLite）或远程分布式存储时，需要重写整个 Manager 内部的代码。

**实现方案**：我们新建子包 `packages/storage`，对单文件和多文件存储操作进行接口抽象。

### 存储接口定义 (`packages/storage/src/types.ts`)

```ts
/** 通用 JSON 文档存储（单文件，用以支持 MemoryManager） */
export interface JsonFileStore {
  read<T>(path: string, fallback: T): T;
  write<T>(path: string, data: T): void;
  exists(path: string): boolean;
}

/** 目录型多文档存储（用以支持 SessionManager） */
export interface JsonDirStore {
  ensureDir(dir: string): void;
  list(dir: string): string[];
  read<T>(filePath: string): T | null;
  write<T>(filePath: string, data: T): void;
  remove(filePath: string): void;
}
```

### 默认本地文件系统实现 (`packages/storage/src/file-store.ts`)

我们为上述两个接口分别提供基于本地磁盘文件系统的 `FileJsonStore` 与 `FileDirStore` 实现。

在 `MemoryManager` 与 `SessionManager` 中，我们通过**依赖注入（Dependency Injection）**传入接口，从而使 Manager 解脱对具体文件操作的感知：

```ts
// packages/core/src/memory/manager.ts
export class MemoryManager {
  constructor(
    private filePath: string,
    private store: JsonFileStore = new FileJsonStore()
  ) {}

  load() {
    const data = this.store.read<MemoryData>(this.filePath, { ... });
    // ...
  }
}
```

> [!TIP]
> 这是一个典型的符合**开闭原则（Open-Closed Principle）**的工程升级。当我们在 L2 阶段后续想要接入 SQLite 存储时，只需要实现 `JsonFileStore` 接口并注入给 `MemoryManager` 即可，其内部的记忆检索逻辑一行都不需要改动。

---

## 3. 上下文拼装解耦：ContextBuilder

**为什么**：随着 Memory 检索、Skills 大纲、可用 Tools 白名单的增加，拼接发送给大模型的 `system` 角色 Prompt 变得非常臃肿。如果将所有拼装代码硬编码在 `Agent.run()` 方法内，会导致该方法过长且无法对其进行独立的单元测试。

**实现方案**：在核心包中独立出 `ContextBuilder` 单元。

### 详细实现 (`packages/core/src/context/builder.ts`)

```ts
export class ContextBuilder {
  constructor(private identity: string = "你是 hachimi，一个个人 AI 助理。") {}

  async build(input: ContextBuildInput = {}): Promise<BuiltContext> {
    const blocks: string[] = [];

    // 1. 组装可用技能大纲
    if (input.skills) {
      const desc = input.skills.getPromptDescriptions();
      if (desc) {
        blocks.push(`【当前可用技能列表】\n${desc}\n\n【强制规则】只能使用上述列表内的技能。`);
      }
    }

    // 2. 组装当前用户明确激活的专业技能（On-demand Skills）
    if (input.activeSkill && input.skills) {
      const full = await input.skills.getFullSkill(input.activeSkill);
      if (full) {
        blocks.push(`【激活技能：${input.activeSkill}】\n${full.instructions}\n\n请严格按照指令完成任务。`);
      }
    }

    // 3. 组装身份定义
    blocks.push(input.identityOverride ?? this.identity);

    // 4. 组装检索出的相关记忆上下文
    if (input.memories && input.memories.length > 0) {
      const memoryText = "以下是与当前对话相关的记忆，请参考：\n" +
        input.memories.map((m) => `- (${m.layer}) ${m.content}`).join("\n");
      blocks.push(memoryText);
    }

    // 5. 组装可用工具声明
    if (input.tools) {
      const list = input.tools.list();
      if (list.length > 0) {
        const toolsText = "【可用工具】\n" +
          list.map((t) => `- ${t.name} [${t.permission ?? "safe"}]: ${t.description}`).join("\n");
        blocks.push(toolsText);
      }
    }

    return {
      systemPrompt: blocks.join("\n\n"),
      parts: { ... }
    };
  }
}
```

---

## 4. 技能按需动态加载 (On-demand Skills)

在 L1 阶段，我们提出了 Lazy Skills 思想，但遗留了如何动态激活技能的问题。

在 Phase A 中，我们在 `Agent.ts` 中通过捕获用户输入的特定意图指令，实现了**按需唤醒完整技能**的最小闭环逻辑：

```ts
// packages/core/src/agent/agent.ts -> run()

// 1. 使用正则表达式匹配类似 "使用 writing 技能" 或 "用 summary 技能" 的句子
let activeSkill: string | undefined;
const skillMatch = input.match(/(?:用|使用|以|调用)\s*([\w\u4e00-\u9fa5]+)\s*技能/i);

if (skillMatch) {
  activeSkill = skillMatch[1].trim();
  console.log(`[Skill] 检测到激活技能意图: ${activeSkill}`);
}

// 2. 将 activeSkill 传递给 ContextBuilder
const built = await this.contextBuilder.build({
  userInput: input,
  memories: relevantMemories,
  skills: this.skills,
  tools: this.tools,
  activeSkill, // 传递激活状态
});
```

当 `activeSkill` 被传入后，`ContextBuilder` 会触发 `skills.getFullSkill(name)`，拉取如 `writing` 技能所配置的完整 System Prompt（例如：“你现在处于「写作助手」模式。请遵循以下原则...”）并拼接进去。从而实现了完美的“按需唤醒”。

---

## 5. 工具风险分级与拦截骨架

**为什么**：为未来的权限拦截奠定契约骨架。

**实现**：
我们在 `ToolDefinition` 中添加了 `permission` 字段，其类型定义为：
```ts
type ToolPermission = "safe" | "needs_confirm" | "dangerous";
```

在 `ToolRegistry.execute` 执行入口中，我们对风险进行前置检查与文字阻断：

```ts
// packages/core/src/tools/registry.ts -> execute()

const level = tool.permission ?? "safe";

if (level === "dangerous" && !options?.confirm) {
  return `需要确认才能执行危险工具: ${name}`;
}

if (level === "needs_confirm" && !options?.confirm) {
  return `需要确认才能执行工具: ${name}。请在后续版本中批准。`;
}
```

这作为一个拦截占位，当后续 L2 引入真正的审批通道时，我们可以在此触发确认提示。

---

## 6. 基于 Vitest 的测试架构

**为什么**：有了测试，我们才能放心地重构 Agent Loop 核心代码，而不必每次都在命令行里手动提问。

我们在项目根目录创建了 `vitest.config.ts`：

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
  },
});
```

在 `packages/core/src/agent/agent.test.ts` 中，我们编写了完整的 Agent Calculator 回合自动化流测试。即使不调用真实 LLM，也能确保整个 ReACT 状态流转不会由于代码重构而崩塌：

```ts
import { describe, it, expect } from "vitest";
import { Agent, ToolRegistry, MockLLMProvider, MemoryManager } from "./index.js";
import { FileJsonStore } from "@hachimi/storage";

describe("Agent tool loop", () => {
  it("calculator tool returns numeric result text", async () => {
    const tools = new ToolRegistry();
    tools.register({
      name: "calculator",
      description: "calc",
      permission: "safe",
      parameters: { ... },
      async execute(args) {
        const { a, b, operator } = args as { a: number; b: number; operator: string };
        if (operator === "+") return String(a + b);
        return "0";
      },
    });

    const agent = new Agent({
      llm: new MockLLMProvider(),
      tools,
      memory: new MemoryManager("data-test.json", new FileJsonStore()),
    });

    const reply = await agent.run("请计算 1+2");
    expect(reply).toMatch(/3/); // 验证工具循环及最终回复匹配
  });
});
```

---

## 7. 稳定 TUI readline 交互入口

我们放弃了之前脆弱的 `scripts/chat.ts` 临时脚本，在 `apps/tui/src/app-context.ts` 中通过读取全局 `config`、注入 `FileStore`，实例化了整个 Core 的全局 AppContext 上下文容器。

在 `apps/tui/src/main.ts` 中，我们启动了包含 `/status`（查看配置与存储状态）、`/help` 帮助指引以及 `/cleanup`（记忆去重与老化裁剪）在内的全功能 Readline TUI 终端。

### 本地启动命令
在根目录下运行：
```bash
pnpm dev:tui
```

---

## 验证清单

为了确保 Phase A 地基没有问题，你可以运行以下命令进行自测：
- 运行测试套件：`pnpm test` (应全绿通过)
- 启动终端：`pnpm dev:tui`
- 输入 `/status` 验证数据目录与大模型 Provider 已被 `loadConfig` 正确载入。
- 输入 `使用 writing 技能`，观察控制台是否成功输出 `[Skill] 检测到激活技能`。

---

## 本章总结

通过 Phase A 的系统重构，我们完成了 Harness 从“实验玩具”向“可维护软件”的质变：
1. **配置**通过环境变量与本地 JSON 统一调度。
2. **存储**通过抽象协议解耦，天然支持未来的 SQLite 数据库升级。
3. **Prompt 的组装**被剥离为高可测的独立 ContextBuilder。
4. **工具风险**与**技能动态加载**在核心层面完成了基础逻辑闭环。

基础地基已然十分稳固。在下一章，我们将讨论 [L2 的进一步演化计划](13-总结与 L2 路线.md)。
