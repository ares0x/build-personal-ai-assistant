# 05. 交互式 CLI

## 目标

在 Phase 1 和 Phase 2 的基础上，做一个真正可以对话的交互式 CLI，方便我们：

- 实时测试 Agent 行为
- 手动管理记忆
- 验证自然语言能力

## 基本结构

使用 Node.js 自带的 `readline/promises` 实现：

```ts
const rl = readline.createInterface({ input, output });

while (true) {
  const userInput = (await rl.question("你: ")).trim();
  // 处理命令或交给 Agent
}
```

## 支持的命令

| 命令 | 作用 |
|------|------|
| `/memories` | 查看当前所有记忆 |
| `/remember <内容>` | 手动添加长期记忆 |
| `/clear session` | 清空会话记忆 |
| `/exit` | 退出 |

这些命令在调用 Agent 之前被拦截处理。

## 自然语言记住

为了提升体验，我们增加了自然语言记住的能力。
用户可以直接说：

- 「请记住我喜欢喝手冲咖啡」
- 「记住我每周五要写周报」
- 「帮我记一下明天要开会」

实现方式是在 `Agent.run()` 的最前面做意图检测：

```ts
const rememberPrefixes = ["请记住", "记住", "帮我记一下", "记一下"];

for (const prefix of rememberPrefixes) {
  if (input.startsWith(prefix)) {
    const content = input.slice(prefix.length).replace(/^[：:\s]+/, "").trim();
    if (content) {
      this.memory.remember(content, 0.75);
      return `好的，我已经记住了：${content}`;
    }
  }
}
```

当前使用简单前缀匹配，后续接入真实 LLM 后，可以升级为更智能的 Tool 调用。

## 完整交互流程

1. 用户输入
2. 判断是否为特殊命令 → 直接处理
3. 否则交给 `agent.run()`
4. Agent 内部先检测是否为「记住」意图
5. 如果不是，则检索记忆 → 调用 LLM → 返回结果

## 本章总结

交互式 CLI 让我们第一次真正「用起来」hachimi。
目前已支持：

- 正常对话
- 命令式记忆管理
- 自然语言记住
- 记忆持久化

虽然 UI 还很简陋，但它已经是一个可用的最小产品雏形。
下一阶段我们将考虑接入真实 LLM，让回答质量得到质的提升。
