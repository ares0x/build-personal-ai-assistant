# 03. Phase 1：最小可用核心

## 设计目标

实现一个**最小可运行**的 Agent 核心，验证以下链路是否能跑通：

用户输入 → Agent 思考 → 调用工具 → 返回结果

本阶段我们刻意做得非常简单，只追求「能跑通」，不追求完美。

## 为什么先做最小核心？

在构建复杂系统时，最容易犯的错误是一开始就追求完美架构。

我们选择的策略是：

> **先跑通垂直链路（Vertical Slice），再系统化改进。**

这样可以：

- 尽早验证核心设计是否合理
- 保持开发节奏和成就感
- 降低后期重构的风险

## 本阶段要实现的模块

1. **ToolRegistry**：工具的注册与执行
2. **MockLLMProvider**：不调用真实大模型的模拟 LLM
3. **Agent**：最简 Agent 循环
4. 一个简单的测试脚本验证闭环

## ToolRegistry 实现

```ts
// packages/core/src/tools/registry.ts
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list() {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    try {
      return await tool.execute(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error executing tool ${name}: ${message}`;
    }
  }
}
```

设计要点：

- 使用 Map 存储工具，查找效率高
- `execute` 内部做了错误捕获，避免工具异常导致整个 Agent 崩溃
- 职责单一：只负责注册和执行，不关心权限（权限放到后续阶段）

## MockLLMProvider

真实 LLM 调用会带来 API Key、网络、费用等问题。Phase 1 我们先用 Mock 来验证流程。

```ts
export class MockLLMProvider implements LLMProvider {
  async chat(messages: Message[], tools: ToolDefinition[] = []): Promise<LLMResponse> {
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const content = lastUser?.content ?? "";

    // 简单规则：检测到计算表达式就调用工具
    const calcMatch = content.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
    if (calcMatch && tools.some(t => t.name === "calculator")) {
      const [, a, op, b] = calcMatch;
      return {
        content: null,
        tool_calls: [{
          id: generateId("call_"),
          name: "calculator",
          arguments: { a: Number(a), b: Number(b), operator: op }
        }]
      };
    }

    return {
      content: `我是 hachimi 的 MockLLM。你刚才说：${content}`
    };
  }
}
```

## 最简 Agent 循环

```ts
export class Agent {
  constructor(private options: {
    llm: LLMProvider;
    tools: ToolRegistry;
    maxToolRounds?: number;
  }) {}

  async run(userInput: string): Promise<string> {
    const messages: Message[] = [{
      id: generateId("msg_"),
      role: "user",
      content: userInput,
      timestamp: Date.now()
    }];

    let rounds = 0;
    const maxRounds = this.options.maxToolRounds ?? 5;

    while (rounds < maxRounds) {
      rounds++;
      const response = await this.options.llm.chat(messages, this.options.tools.list());

      // 没有工具调用，直接返回最终回答
      if (!response.tool_calls?.length) {
        return response.content ?? "";
      }

      // 执行工具并把结果加入消息历史
      for (const call of response.tool_calls) {
        const result = await this.options.tools.execute(call.name, call.arguments);
        messages.push({
          id: generateId("msg_"),
          role: "tool",
          content: result,
          tool_call_id: call.id,
          name: call.name,
          timestamp: Date.now()
        });
      }
    }

    return "达到最大工具调用轮次，已停止。";
  }
}
```

## 我们踩过的坑

**坑 1：工具调用死循环**

最初 MockLLM 每次都只看最后一条 user 消息。当工具执行完后，再次调用 LLM 时，它又返回了相同的 tool_call，导致无限循环。
解决方法：让 MockLLM 判断最后一条消息是否是 tool 角色，如果是，就直接给出最终答案。

**坑 2：路径与模块导入问题**

早期 `generateId` 散落在多个文件，相对路径也写错，导致运行时报 `ERR_MODULE_NOT_FOUND`。
这也是我们后来专门做一次重构的原因。

## 本章总结

Phase 1 我们成功验证了：

- 工具可以注册和执行
- Agent 循环可以正常运转
- 工具调用 → 结果回流的基本模式是可行的

虽然现在的实现非常简陋（尤其是 MockLLM），但它已经具备了最核心的骨架。
下一章我们将引入本项目最重要的能力之一：分层 Memory。
