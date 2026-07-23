---
title: 09. 消息持久化与 Session 多会话管理
description: 本章讲解个人 AI 助理中 Memory（记忆）与 Session（短期会话历史）的边界与划分，并基于本地多 JSON 文件实现跨会话重启恢复与保存。
keywords: 消息持久化, SessionManager, 多会话切换, 会话恢复, 本地 JSON 读写
---

# 09. 持久化与 Session 管理

## 本章目标

在本章中，我们将为 `hachimi` 这个 Demo 补充最基础的**对话连续性与会话物理恢复功能**。

我们希望：
- 对话上下文能够在后台写入本地磁盘，使我们能够跨终端重启复原聊天历史。
- 提供极简的多话题（Session）归档与加载，理解会话切换的核心原理。
- 这一章继续采用**最轻量级的本地 JSON 读写文件**方案，不引入任何数据库依赖。

---

## 记忆（Memory）与会话历史（Session）的划分

在设计助理类 Agent 的持久化时，我们通常将状态信息拆分为两种不同生命周期的类型：

| 对象 | 解决的问题 | 典型数据 | 在 Prompt 中的传递方式 |
| :--- | :--- | :--- | :--- |
| **Memory (记忆)** | 全局的用户习惯 facts | 用户偏好习惯（如：用户喜欢美式咖啡） | 通过关键词搜索出的若干事实，注入到系统 System 提示词中。 |
| **Session (会话)** | 单次长对话的语境流转 | 消息明细（`user`, `assistant`, `tool`） | 直接作为完整的历史消息序列（Messages 数组）发送给 API。 |

Harness 的职责是协同两者：用 **Session** 还原最近几分钟的对话细节，用 **Memory** 附带用户的长期背景信息。

---

## 实现 SessionManager

我们在核心包下创建文件 `packages/core/src/session/manager.ts`。这是一个最简单的文件夹扫描读写器：

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateId } from "@hachimi/shared";
import type { Session, Message } from "../types/index.js";

export class SessionManager {
  private dir: string;
  private current: Session | null = null;

  constructor(dir = "data/sessions") {
    this.dir = dir;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 创建一个新会话对象并持久化
   */
  create(title?: string): Session {
    const session: Session = {
      id: generateId("sess_"),
      title: title || `会话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.current = session;
    this.save(session);
    return session;
  }

  /**
   * 获取当前活跃会话；如无则新建
   */
  getOrCreate(): Session {
    if (this.current) return this.current;
    
    const list = this.list();
    if (list.length > 0) {
      const latest = this.load(list[0].id);
      if (latest) return latest;
    }
    return this.create();
  }

  /**
   * 从 JSON 文件还原会话
   */
  load(id: string): Session | null {
    const file = join(this.dir, `${id}.json`);
    if (!existsSync(file)) return null;

    try {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      this.current = data;
      return data;
    } catch (err) {
      console.error(`[Session] 加载失败 ${id}:`, err);
      return null;
    }
  }

  /**
   * 同步会话状态到磁盘
   */
  save(session?: Session) {
    const target = session || this.current;
    if (!target) return;

    target.updatedAt = Date.now();
    const file = join(this.dir, `${target.id}.json`);
    try {
      writeFileSync(file, JSON.stringify(target, null, 2), "utf-8");
    } catch (err) {
      console.error("[Session] 保存失败:", err);
    }
  }

  /**
   * 追加单条消息并触发保存
   */
  appendMessage(message: Message) {
    const session = this.getOrCreate();
    session.messages.push(message);
    this.save(session);
  }

  getHistory(): Message[] {
    return this.current?.messages ?? [];
  }

  getCurrent(): Session | null {
    return this.current;
  }

  /**
   * 扫描目录获取所有历史 JSON 的描述大纲
   */
  list(): Array<{ id: string; title?: string; updatedAt: number }> {
    try {
      if (!existsSync(this.dir)) return [];

      return readdirSync(this.dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          try {
            const data = JSON.parse(readFileSync(join(this.dir, f), "utf-8"));
            return {
              id: data.id,
              title: data.title,
              updatedAt: data.updatedAt,
            };
          } catch {
            return null;
          }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
      console.error("[Session] 读取会话列表失败:", err);
      return [];
    }
  }
}
```

---

## 串联 CLI 运行测试

更新我们的交互控制台程序 `scripts/chat.ts`，在接收输入后：
1. 从 `SessionManager` 读取当前会话的历史消息数组。
2. 调用 `agent.run(userInput, history)`，将历史一并送入 LLM。
3. 得到助理回复后，将这一对消息通过 `appendMessage` 追加落盘。

```ts
const sessions = new SessionManager("data/sessions");
const session = sessions.getOrCreate();

// ... 在 Readline 循环中
const history = sessions.getHistory();
const reply = await agent.run(userInput, history);

// 追加到本地物理文件
sessions.appendMessage({ role: "user", content: userInput, ... });
sessions.appendMessage({ role: "assistant", content: reply, ... });
```

---

## 本地文件结构与局限

对话进行后，`data/` 目录结构呈现如下：

```text
data/
├── memory.json             # 存放全局长期事实 (L3 Memory)
└── sessions/               # 存放各个独立会话历史 (L2 Session)
    ├── sess_4ca39b82.json
    └── sess_9e88d01a.json
```

### 设计局限与思考

文件持久化方案虽然简单易读，但在生产环境中有很大的局限性：
- **无增量读写**：每次追加一条消息，我们都需要将整个会话数组重新 JSON 序列化并全量写入磁盘，这在对话极长时会产生不小的磁盘 I/O 损耗。
- **不支持并发**：本地文件读写没有事务性保护。
- **无 Context 压缩**：本阶段并未引入对历史消息的消息截断或摘要压缩算法（即只是简单地把所有历史消息越叠越长发给大模型）。

这些局限我们将在以后的升级演进中再讨论解决方案。

---

## 本章总结

本章我们：
- 区分了 Memory 和 Session 两大持久化实体。
- 编写了一个仅包含核心逻辑的本地 JSON 会话管理器 `SessionManager`。
- 打通了 CLI 终端的连续多轮会话功能。
- 讨论了当前全量 JSON 读写与未压缩上下文的设计局限。
