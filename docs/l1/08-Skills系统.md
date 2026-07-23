---
title: 08. Skills 系统：系统 Prompt 的惰性加载与设计
description: 本章详解 Agent 的 Skills（技能）系统骨架设计，演示如何通过 Lazy Skills 惰性加载机制只在 Prompt 中暴露技能大纲描述，节约 Token 消耗。
keywords: Skills 系统, 技能注册表, Lazy Skills, 惰性加载, System Prompt, Token 节约
---

# 08. Skills 系统

## 本章目标

随着我们希望助理完成不同类型的任务（例如写作、总结、翻译），如果我们为每一种场景都写一段超长的系统指令，并把它们一次性全部塞入 System Prompt，这会迅速耗尽我们的上下文窗口，导致每次调用的延迟与 Token 成本剧增。

本章的目标是：**实现一个最小可用的 Skills（技能）系统结构**，演示如何利用类似 **Pi 的 Lazy Skills（惰性加载技能）** 思想来精简提示词：
- 系统初始化时，在主 Prompt 中仅放置技能的名称与一句话简短简介。
- 引导大模型认识自己的“技能边界”。
- 演示在基础架构上如何为以后“当用户需要时，动态拉取并注入完整指令（Lazy Loading）”做好设计预留。

---

## 核心设计与数据结构

在 `packages/core/src/types/index.ts` 中，我们为技能声明了如下简易契约：

```ts
/**
 * 技能定义（演示用）
 */
export interface SkillDefinition {
  name: string;
  description: string; // 显示在系统提示词中的一句话大纲介绍
  /**
   * 异步加载函数：用于演示后续如何按需加载完整的长篇指令集
   */
  load: () => Promise<SkillContent> | SkillContent;
  tags?: string[];
}

export interface SkillContent {
  instructions: string; // 技能的完整 System Prompt
  tools?: string[];     // 该技能推荐使用的工具名称列表
  examples?: string[];  // Few-Shot 示例
}
```

### 1. 实现 SkillRegistry 注册表

我们编写 `packages/core/src/skills/registry.ts`，统一收集和管理当前 Demo 启用的技能清单：

```ts
import type { SkillDefinition, SkillContent } from "../types/index.js";

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition) {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill already registered: ${skill.name}`);
    }
    this.skills.set(skill.name, skill);
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * 将当前所有可用技能的名称与描述，序列化为系统 Prompt 所需的简短大纲列表
   */
  getPromptDescriptions(): string {
    if (this.skills.size === 0) return "";

    const lines = this.list().map(
      (s) => `- ${s.name}: ${s.description}`
    );
    return `你可以使用以下技能（需要时再深入使用）：\n${lines.join("\n")}`;
  }

  async loadContent(name: string): Promise<SkillContent | null> {
    const skill = this.skills.get(name);
    if (!skill) return null;
    return await skill.load();
  }
}
```

### 2. 注入 Agent 上下文

我们把可用技能的简短大纲拼入 `Agent.ts` 拼装 System Prompt 的过程中：

```ts
// packages/core/src/agent/agent.ts -> run()

if (this.skills) {
  const skillDesc = this.skills.getPromptDescriptions();
  if (skillDesc) {
    systemParts.push(
      `【当前可用技能列表】\n${skillDesc}\n\n请严格基于以上列表回答关于你具备哪些技能的问题。`
    );
  } else {
    systemParts.push(`【当前可用技能列表】\n（空）`);
  }
}
```

---

## 示例技能编写

我们在 `packages/core/src/skills/examples/` 中模拟了两个简易的技能配置文件：

### 1. 写作技能：writing.ts
```ts
import type { SkillDefinition } from "../../types/index.js";

export const writingSkill: SkillDefinition = {
  name: "writing",
  description: "帮助用户进行写作、润色、改写和结构化表达",
  tags: ["writing", "content"],
  load: () => ({
    instructions: `
你现在处于「写作助手」模式。请遵循以下原则：
1. 保持用户的原意，只优化表达。
2. 语言简洁有力。
`.trim(),
  }),
};
```

### 2. 摘要技能：summary.ts
```ts
import type { SkillDefinition } from "../../types/index.js";

export const summarySkill: SkillDefinition = {
  name: "summary",
  description: "帮助用户总结长文、提取要点并生成大纲摘要",
  tags: ["summary", "writing"],
  load: () => ({
    instructions: `
你现在处于「总结助手」模式。请遵循以下原则：
1. 先给出核心结论。
2. 列表给出关键要点。
`.trim(),
  }),
};
```

---

## 测试验证与局限说明

在 CLI 客户端 `scripts/chat.ts` 中注册并传入 Agent：

```ts
const skills = new SkillRegistry();
skills.register(writingSkill);
skills.register(summarySkill);

const agent = new Agent({ llm, tools, memory, skills });
```

### 演示效果

当我们在终端里问大模型你会什么时：

> **你:** “你支持哪些技能？”
> **hachimi:** 
> 我目前被配置了以下两个技能：
> - writing: 帮助用户进行写作、润色、改写和结构化表达
> - summary: 帮助用户总结长文、提取要点并生成大纲摘要
> 
> 请问需要使用哪一项服务？

### L1 阶段的局限

必须指出的是，本阶段我们**仅仅实现了“大纲级系统提示词注入与能力对齐”**。以下两个进阶能力在 L1 阶段并未编写，仅留作思考：
- **动态加载（Dynamic Load）**：即当用户表示“帮我重写这篇文章”时，程序如何在后台监听到意图，并动态调用 `load()` 将完整 instructions 追加至对话历史中。
- **技能与工具链联动**：技能目前并未主动接管或限制工具的调用范围。

这些更为复杂的策略，将在以后的新合集中去实现。

---

## 本章总结

本章我们：
- 讲解了 Lazy Skills 的核心价值，防止提示词爆仓。
- 实现了一个最简的 `SkillRegistry` 注册模块。
- 演练了如何向大模型声明其当下的技能范围，使其回复更加克制和准确。
