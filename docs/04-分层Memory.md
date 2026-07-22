# 04. 分层 Memory

## 为什么 Memory 如此重要？

对于个人 AI 助理来说，「越来越懂我」是核心体验。

LLM 本身是无状态的，真正让它具备连续性的，是 Harness 中的 **Memory 系统**。

本阶段我们实现一个清晰的分层 Memory，并先用内存 + 文件持久化的方式跑通。

## 分层设计

我们采用四层结构（重点参考 Claude Code 的分析）：

| 层级 | 名称 | 生命周期 | 作用 |
|------|------|----------|------|
| 1 | Working | 当前回合 | 最近对话上下文 |
| 2 | Session | 单次会话 | 关键决策、摘要、待办 |
| 3 | Long-term | 永久 | 用户偏好、习惯、事实 |
| 4 | Archival | 永久 | 文档、笔记、生成物 |

当前阶段重点实现 **Long-term** 和 **Session**，Working 和 Archival 预留接口。

## 核心实现：MemoryManager

```ts
export class MemoryManager {
  private working: MemoryEntry[] = [];
  private session: MemoryEntry[] = [];
  private longTerm: MemoryEntry[] = [];
  private archival: MemoryEntry[] = [];

  add(params: {
    layer: MemoryLayer;
    content: string;
    importance?: number;
  }): MemoryEntry {
    // ...
  }

  search(query: string, options?: MemorySearchOptions): MemoryEntry[] {
    // 当前使用简单关键词 + 重要性排序
    // 后续可替换为向量检索
  }

  remember(content: string, importance = 0.7) {
    return this.add({
      layer: "long_term",
      content,
      importance,
    });
  }
}
```

设计要点：

- `MemoryEntry` 作为核心公共类型，放在 `src/types` 中
- `search` 目前是轻量实现，保持接口稳定，方便以后替换检索算法
- `remember` 是对用户最友好的快捷方法

## 与 Agent 的集成

Agent 在每次 `run` 时会：

1. 根据用户输入检索相关记忆
2. 将记忆注入为 system 消息
3. 再交给 LLM 生成回复

```ts
const relevantMemories = this.memory.search(userInput, {
  layers: ["session", "long_term"],
  limit: 6,
});

if (relevantMemories.length > 0) {
  // 注入 system 消息
}
```

这样 LLM 就能「看到」相关的长期记忆。

## 文件持久化

为了让记忆跨会话保留，我们增加了简单的 JSON 文件持久化：

- 默认存储路径：`data/memory.json`
- 实例化时自动 `load()`
- 每次 `add` / `remember` / `forget` 后自动 `save()`

```ts
const memory = new MemoryManager("data/memory.json");
```

这是最小可用的持久化方案，后续可以平滑替换成 SQLite 或向量数据库。

## 本章总结

Phase 2 我们完成了：

- 清晰的分层 Memory 设计
- `MemoryManager` 的基础能力
- 与 Agent 的检索与注入
- 简单的文件持久化

Memory 已经成为 hachimi 最重要的基础能力之一。
下一章我们会基于它实现更好的交互体验。
