# 09. 持久化与 Session 管理

## 本章目标

让对话具备「连续性」：

- 记忆（Memory）可以跨进程保留
- 会话（Session）的历史消息可以保存和恢复
- CLI 重启后仍能继续之前的对话上下文

本阶段继续采用**文件持久化**的最小方案，保持实现简单、可替换。

## 两个不同的持久化对象

| 对象 | 解决的问题 | 存储内容 | 生命周期 |
|------|------------|----------|----------|
| **Memory** | 越来越懂用户 | 用户偏好、事实、长期知识 | 永久 |
| **Session** | 单次/多次对话的连续性 | 消息历史（user / assistant / tool） | 可长可短 |

两者配合：

- Memory 提供「关于用户的长期知识」
- Session 提供「当前这场对话说了什么」

## Memory 持久化（回顾）

上一阶段我们已经实现：

- 默认存储路径：`data/memory.json`
- 启动时 `load()`
- 每次 `add` / `remember` 后自动 `save()`

这保证了「请记住…」的内容在重启后仍然存在。

## Session 设计

### 核心类型

```ts
interface Session {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}
```

### SessionManager 职责

- `create()` / `getOrCreate()`：创建或获取当前会话
- `load(id)`：加载历史会话
- `save()`：持久化到 `data/sessions/<id>.json`
- `appendMessage()`：追加消息并保存
- `getHistory()`：返回当前会话消息，供 Agent 使用
- `list()`：列出所有会话

### 存储结构

```text
data/
├── memory.json              # 长期记忆
└── sessions/
    ├── sess_xxx.json        # 会话 1
    └── sess_yyy.json        # 会话 2
```

## 与 CLI / Agent 的集成

启动时：

```ts
const sessions = new SessionManager("data/sessions");
const session = sessions.getOrCreate();
```

每次对话：

```ts
const history = sessions.getHistory();
const reply = await agent.run(userInput, history);

// 写入本轮消息
sessions.appendMessage({ role: "user", content: userInput, ... });
sessions.appendMessage({ role: "assistant", content: reply, ... });
```

这样 Agent 每次都能看到完整的会话历史，从而实现多轮连续对话。

## 支持的命令

| 命令 | 作用 |
|------|------|
| `/sessions` | 列出所有历史会话 |
| `/clear session` | 清空当前会话消息 |
| `/exit` | 退出前自动保存 |

## 设计取舍

为什么先用 JSON 文件？

- 实现简单，零依赖
- 方便查看和调试
- 对个人 Demo 完全足够

后续可替换为：

- SQLite（更好的查询与事务）
- 向量数据库（增强 Memory 检索）
- 远程存储（多端同步）

只要保持 SessionManager / MemoryManager 的接口稳定，底层存储可以平滑升级。

## 测试验证

1. 启动 CLI，进行多轮对话
2. 执行 `/sessions` 确认会话存在
3. 退出后重新启动
4. 观察是否加载了之前的会话，并且 Agent 能利用历史上下文
5. 检查 `data/sessions/` 目录下的 JSON 文件

## 本章总结

我们完成了 L1 阶段的持久化闭环：

- Memory：跨会话的长期知识
- Session：单场对话的消息历史
- 两者都以文件形式持久化，并与 CLI、Agent 集成

这使 hachimi 从一个「每次从零开始」的脚本，变成了具备基本连续性的个人助理原型。
下一章我们将展望多渠道支持，并明确 L1 的边界。
