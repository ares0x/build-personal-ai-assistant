---
title: 05. 交互式 CLI 控制台与斜杠指令拦截 | hachimi 教程
description: 本章讲解使用 Node.js 的 readline/promises 模块搭建与 Agent 核心交互的终端对话接口，并编写 /remember 等 Slash 命令过滤器。
keywords: 交互式 CLI, readline, Slash 命令, 会话清空, 命令行 Agent, 交互终端
---

# 05. 交互式 CLI

## 目标

在跑通基础的核心循环和记忆机制之后，如果每次测试都需要通过修改 `tsx scripts/test-phase2.ts` 的硬编码来调试，开发体验显然非常低下。

本章的目标是：构建一个功能完备的**交互式命令行客户端（CLI Chatbot）**。在这个客户端中，我们将实现：
- 像聊天软件一样的实时双向对话交互（ReadLine 循环）。
- **斜杠指令（Slash Commands）**的拦截，允许用户手动管理记忆与清空会话。
- **自然语言隐式记忆拦截**，用户通过直白地命令助理“记住某件事”，不需要输入复杂的特殊指令。

---

## readline/promises 构建会话循环

在 Node.js 中，我们可以直接使用原生的 `node:readline/promises` 模块来接收终端的用户输入，避免引入臃肿的第三方 CLI 库。

以下是我们的会话主循环结构原型：

```ts
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

console.log("hachimi CLI 交互开始（输入 /exit 退出）\n");

while (true) {
  const userInput = (await rl.question("你: ")).trim();
  if (!userInput) continue;

  if (userInput === "/exit") {
    console.log("再见！");
    break;
  }

  // 交给 Agent 处理
  const reply = await agent.run(userInput);
  console.log(`hachimi: ${reply}\n`);
}

rl.close();
```

---

## 拦截斜杠指令（Slash Commands）

对于调试记忆和会话状态，提供几个特殊的短指令是极有帮助的。我们在主 readline 循环中，在将输入送进 Agent 之前，拦截以下指令：

| 指令 | 参数 | 作用 |
| :--- | :--- | :--- |
| `/memories` | 无 | 打印并列出当前内存中各个分层存储的全部记忆。 |
| `/remember` | `<内容>` | 绕过聊天，直接手动追加一条长期（long_term）记忆事实。 |
| `/sessions` | 无 | 列出所有历史会话（当前阶段留作预留）。 |
| `/clear session` | 无 | 强制清空当前的会话，重置上下文。 |
| `/exit` | 无 | 优雅保存所有未同步的数据，退出 CLI 进程。 |

### 拦截逻辑的实现

在 `scripts/chat.ts` 的循环中实现拦截：

```ts
const command = userInput.toLowerCase();

if (command === "/memories") {
  const all = memory.list();
  console.log("\n当前记忆：");
  if (all.length === 0) {
    console.log("（空）");
  } else {
    all.forEach((m) => {
      console.log(`[${m.layer}] (重要度: ${m.importance}) ${m.content}`);
    });
  }
  console.log();
  continue; // 拦截，不交给 Agent
}

if (userInput.startsWith("/remember ")) {
  const content = userInput.slice("/remember ".length).trim();
  if (!content) {
    console.log("用法：/remember <要记住的内容>\n");
    continue;
  }
  memory.remember(content, 0.75);
  console.log(`已成功保存长期记忆：${content}\n`);
  continue;
}
```

---

## 自然语言隐式记忆

除了用 `/remember` 这种生硬的命令行方式，个人助理应该能听懂你在普通聊天中说的话。

例如你输入：`“请记住，我是一个前端程序员”`。

我们不希望模型返回一大堆空话，而是希望 Harness 控制系统能够拦截这一句意图，直接完成后台写入，并给用户一个温和的确定反馈。

我们在 `packages/core/src/agent/agent.ts` 的 `run` 方法入口处做如下前缀拦截匹配：

```ts
// packages/core/src/agent/agent.ts -> run()

const input = userInput.trim();

// 记忆声明的常见前缀
const rememberPrefixes = ["请记住", "记住", "帮我记一下", "记一下"];

for (const prefix of rememberPrefixes) {
  if (input.startsWith(prefix)) {
    // 裁剪掉前缀，并去除冒号与多余空格
    const content = input.slice(prefix.length).replace(/^[：:\s]+/, "").trim();

    if (content) {
      // 写入 memory 系统的 long_term 长期记忆层，设定 0.75 默认重要度
      this.memory.remember(content, 0.75);
      return `好的，我已经记住了：${content}`;
    } else {
      return "请告诉我你需要记住的具体内容。例如：请记住我周五下午要开会。";
    }
  }
}
```

> [!TIP]
> 这种前缀意图识别虽然简单，但在本地测试和 MockLLM 阶段极其高效。当后续接入真实大模型时，我们可以将这个拦截器升级为大模型的 `Function Calling` 意图，利用模型本身提取更复杂的实体。

---

## 完整的终端交互流程

在 `scripts/chat.ts` 中集成了 CLI 对话循环后，其数据流动流程如下：

```text
用户在终端输入
    │
    ▼
是否有斜杠前缀 / ?
    ├── [是] ──► 匹配命令 (如 /memories, /clear session) ──► 执行本地操作 ──► continue 下一轮
    └── [否] ──► 送入 agent.run(userInput) 
                     │
                     ▼
             匹配自然语言记忆前缀?
                 ├── [是] ──► 调用 memory.remember() ──► 返回 "好的，已记住" ──► 输出并结束
                 └── [否] ──► 检索记忆 ──► 拼装 Prompt ──► LLM 思考与 Tool 执行循环 ──► 得到回复 ──► 记录到 Session 层 ──► 输出并结束
```

---

## 本章总结

通过本章的实现，我们：
- 使用原生的 `readline/promises` 模块构建了免安装、高敏捷度的控制台对话环境。
- 拦截了指令，允许用户随时检查后台的记忆状态，提高了框架透明度。
- 为 Agent 添加了基于简单前缀拦截的自然语言隐式记忆功能，极大地提升了交互亲和力。

我们的代码目录现在散落着各种临时依赖，且 Monorepo 还没有很好地利用 `pnpm workspace` 共享依赖功能。下一章，我们将停下脚步，进行一次非常硬核的[代码重构实践](06-代码重构实践.md)。
