# 08. Skills 系统

## 本章目标

实现一个最小可用的 Skills 系统，让 hachimi 的能力可以按需扩展。

本阶段重点借鉴 **Pi 的 Lazy Skills** 思想：

- 系统提示词中只放技能的一句话描述
- 保持上下文干净
- 为后续「按需加载完整技能内容」打下基础

## 为什么需要 Skills？

Tool 解决的是「能调用外部能力」（计算、搜索、写文件等）。

Skill 解决的是「如何以特定方式完成一类任务」（写作润色、代码审查、会议总结等）。

两者配合，才能让助理既有执行力，又有专业方法论。

## 核心设计

### Skill 定义

```ts
interface SkillDefinition {
  name: string;
  description: string;          // 一句话描述，会进入系统提示词
  load: () => SkillContent;     // 返回完整指令（当前阶段先简单实现）
  tags?: string[];
}

interface SkillContent {
  instructions: string;
  examples?: string[];
}
```

### SkillRegistry

负责技能的注册、查询和生成提示词描述：

```ts
class SkillRegistry {
  register(skill: SkillDefinition) { ... }
  list() { ... }
  getPromptDescriptions(): string {
    // 返回所有技能的简短列表，用于注入 system 提示
  }
  async loadContent(name: string) { ... }
}
```

## 与 Agent 的集成

在构建 system 提示时，按以下顺序注入：

1. 身份与行为规则
2. 相关记忆（Memory）
3. 当前可用技能列表（Skills）

```ts
systemParts.push(`你是 hachimi...（身份与规则）`);

if (relevantMemories.length > 0) {
  systemParts.push(`相关记忆：\n...`);
}

if (this.skills) {
  const skillDesc = this.skills.getPromptDescriptions();
  systemParts.push(`【当前可用技能列表】\n${skillDesc}`);
}
```

关键点是：必须把 `skills` 正确传入 Agent 的构造函数并保存为实例属性，否则注入逻辑不会生效。

## 示例技能：writing

```ts
export const writingSkill: SkillDefinition = {
  name: "writing",
  description: "帮助用户进行写作、润色、改写和结构化表达",
  load: () => ({
    instructions: `
你现在处于「写作助手」模式。请遵循以下原则：
1. 保持用户原意，只优化表达
2. 语言简洁有力
3. 根据需求调整语气
`.trim(),
  }),
};
```

在 CLI 启动时注册：

```ts
const skills = new SkillRegistry();
skills.register(writingSkill);

const agent = new Agent({
  llm,
  tools,
  memory,
  skills,   // 必须传入
});
```

## 测试与验证

启动 CLI 后询问：

```text
你有哪些技能？
```

模型应只基于我们注册的列表回答，例如：

```text
我目前配置了以下技能：
- writing: 帮助用户进行写作、润色、改写和结构化表达
```

如果模型仍然大段介绍自己的通用能力，通常是以下原因之一：

- `skills` 没有被传入 Agent 或没有保存为实例属性
- 系统提示中的约束不够强
- 技能列表没有被正确注入

## 当前实现的局限

本阶段只完成了「技能注册 + 简介注入」的最小闭环，仍有明显不足：

- 完整的 `load()` 内容还没有在对话中被真正使用
- 没有实现「用户明确要求使用某技能时，动态加载完整指令」
- 技能与工具之间还没有建立关联

这些将在后续版本中继续完善。

## 本章总结

我们实现了 Skills 系统的第一阶段：

- 清晰的 Skill 定义与注册机制
- Lazy 风格的简介注入
- 与 Agent、Memory、真实 LLM 的协同工作

虽然还很基础，但它已经为「可扩展的能力系统」打下了结构基础。
