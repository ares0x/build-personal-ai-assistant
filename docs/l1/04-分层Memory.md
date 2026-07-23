---
title: 04. 分层 Memory 记忆机制与检索 | hachimi 教程
description: 本章讲解个人 AI 助理的长期与短期记忆分层架构，演示基于规则匹配与重要度排序的轻量级启发式记忆检索与本地持久化实现。
keywords: AI Agent, Harness 缰绳, 分层记忆, MemoryManager, Context 注入, 启发式检索
---

# 04. 分层 Memory

## 为什么需要演练 Memory？

在大模型开发中，如何管理长对话的上下文（Context）是一个核心工程课题。

大模型接口本身是没有记忆状态的。如果只是将所有的历史对话盲目地推给大模型，随着对话轮次的加深，不仅会消耗大量的 Token 费用，也极易导致大模型在冗长的输入中遗忘关键事实。

在 `hachimi` 这个 Demo 项目中，我们设计了一个**最简分层 Memory 机制的演示模型**，展示如何将用户的习惯、事实通过外围代码进行分类过滤，并动态注入给大模型。

---

## 记忆分层概念设计

我们在 Demo 中模拟了四层记忆模型，用以演练大型 Agent 系统的设计理念：

| 层级 | 名称 | 生命周期 | 存储载体 | 核心作用与使用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **L1** | **Working** | 当前回合（Turn） | 内存 (RAM) | 存放当前这轮工具调用推理的临时变量，跑完立刻释放。 |
| **L2** | **Session** | 单次会话（Session） | 内存 + JSON 文件 | 当前这次对话中累积的关键事项和临时结论。 |
| **L3** | **Long-term** | 永久（Permanent） | 内存 + JSON 文件 | 用户长期的基本事实与偏好习惯。 |
| **L4** | **Archival** | 永久（Permanent） | 预留接口 | 存放海量外部文档或历史笔记，用于展示长期离线知识检索架构。 |

> [!NOTE]
> 作为一个演示 Demo，我们在本章仅实现 **Long-term（长期）** 与 **Session（短期）** 层的本地 JSON 同步。

---

## 模拟实现：MemoryManager

为了降低系统开销并保证代码的可读性，我们没有在本章节引入重量级的向量数据库（Vector DB），而是编写了一个基于关键词匹配与重要度过滤的**启发式内存检索器**。

新建文件 `packages/core/src/memory/manager.ts`：

```ts
import { generateId } from "@hachimi/shared";
import type { MemorySearchOptions } from "./types.js";
import type { MemoryEntry, MemoryLayer } from "../types/index.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class MemoryManager {
  private working: MemoryEntry[] = [];
  private session: MemoryEntry[] = [];
  private longTerm: MemoryEntry[] = [];
  private archival: MemoryEntry[] = [];

  private filePath: string;

  constructor(filePath = "data/memory.json") {
    this.filePath = filePath;
    this.load(); // 自动加载本地 JSON 文件以模拟“状态复原”
  }

  /**
   * 从本地 JSON 文件加载记忆
   */
  load() {
    try {
      if (!existsSync(this.filePath)) return;

      const raw = readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(raw);

      this.working = data.working ?? [];
      this.session = data.session ?? [];
      this.longTerm = data.longTerm ?? [];
      this.archival = data.archival ?? [];

      console.log(`[Memory] 已从 ${this.filePath} 加载历史记忆`);
    } catch (err) {
      console.warn("[Memory] 未检测到记忆文件，使用空内存启动", err);
    }
  }

  /**
   * 将内存记忆持久化到本地 JSON 
   */
  save() {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = {
        working: this.working,
        session: this.session,
        longTerm: this.longTerm,
        archival: this.archival,
      };

      writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("[Memory] 记忆保存失败:", err);
    }
  }

  /**
   * 新增一条记忆，并同步保存
   */
  add(params: {
    layer: MemoryLayer;
    content: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  }): MemoryEntry {
    const entry: MemoryEntry = {
      id: generateId("mem_"),
      layer: params.layer,
      content: params.content,
      importance: params.importance ?? 0.5,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      metadata: params.metadata,
    };

    this.getLayerArray(params.layer).push(entry);
    this.save();
    return entry;
  }

  /**
   * 启发式模拟检索
   */
  search(query: string, options: MemorySearchOptions = {}): MemoryEntry[] {
    const {
      layers = ["working", "session", "long_term"],
      limit = 8,
      minImportance = 0,
    } = options;

    const all: MemoryEntry[] = [];
    for (const layer of layers) {
      all.push(...this.getLayerArray(layer));
    }

    // 演示策略：当提问中包含个人核心敏感词时，直接拉取高重要度的记忆
    const personalKeywords = ["我", "谁", "名字", "项目", "技术", "做什么", "开发"];
    const isPersonalQuery = personalKeywords.some((kw) => query.includes(kw));

    let results = all.filter((e) => e.importance >= minImportance);

    if (isPersonalQuery) {
      results = results
        .filter((e) => e.layer === "long_term" || e.layer === "session")
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);
    } else {
      // 普通查询，回退到简单的字符串大小写包含匹配
      const lowerQuery = query.toLowerCase();
      results = results
        .filter((e) => e.content.toLowerCase().includes(lowerQuery) || lowerQuery.length < 4)
        .sort((a, b) => b.importance - a.importance)
        .slice(0, limit);
    }

    return results.map((e) => {
      e.lastAccessedAt = Date.now();
      return e;
    });
  }

  forget(id: string): boolean {
    const layers: MemoryLayer[] = ["working", "session", "long_term", "archival"];
    for (const layer of layers) {
      const arr = this.getLayerArray(layer);
      const index = arr.findIndex((e) => e.id === id);
      if (index !== -1) {
        arr.splice(index, 1);
        this.save();
        return true;
      }
    }
    return false;
  }

  remember(content: string, importance = 0.7, layer: MemoryLayer = "long_term"): MemoryEntry {
    return this.add({
      layer,
      content,
      importance,
    });
  }

  list(layer?: MemoryLayer): MemoryEntry[] {
    if (layer) {
      return [...this.getLayerArray(layer)];
    }
    return [
      ...this.working,
      ...this.session,
      ...this.longTerm,
      ...this.archival,
    ];
  }

  private getLayerArray(layer: MemoryLayer): MemoryEntry[] {
    switch (layer) {
      case "working": return this.working;
      case "session": return this.session;
      case "long_term": return this.longTerm;
      case "archival": return this.archival;
    }
  }
}
```

---

## 与 Agent 的集成演练

每次执行对话时，我们在外围检索匹配的记忆条目，并把它们组织成一句话以 `system` 角色的身份注入进上下文：

```ts
// packages/core/src/agent/agent.ts -> run()

const relevantMemories = this.memory.search(userInput, {
  layers: ["session", "long_term"],
  limit: 6,
  minImportance: 0.3,
});

if (relevantMemories.length > 0) {
  const memoryText = relevantMemories
    .map((m) => `- (${m.layer}) ${m.content}`)
    .join("\n");
    
  systemParts.push(
    `以下是与当前对话相关的背景信息（用于模拟记忆注入）：\n${memoryText}`
  );
}
```

这是大模型外围控制的最基本操作，能让我们理解记忆到底是以何种姿态被模型所接收的。

---

## 本章总结

本章我们：
- 理清了分层记忆的概念和生命周期。
- 实现了一个极为简单、自动同步至本地 JSON 文件的 `MemoryManager` 模拟器。
- 演练了记忆如何通过外围拼接注入到系统提示词中。

目前我们都是通过单次运行测试脚本来调试。下一章，我们将开发一个控制台 Readline 对话环境，让它更具交互感：[交互式 CLI](05-交互式CLI.md)。
