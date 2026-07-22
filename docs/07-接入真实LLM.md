# 07. 接入真实 LLM

## 本章目标

将 Phase 1 中的 `MockLLMProvider` 替换为真实的大模型调用，使 hachimi 从「能跑的 Demo」变为「真正有用的助理」。

本阶段我们实现一个**通用的 OpenAI Compatible Provider**，同时支持：

- OpenAI 官方接口
- DeepSeek（完全兼容 OpenAI 协议）
- 其他兼容接口（只需修改 `baseURL` 和 `apiKey`）

## 设计原则

1. **保持接口稳定**
   继续使用已有的 `LLMProvider` 接口，Agent 代码几乎不需要修改。

2. **配置驱动**
   通过环境变量切换 Provider 和模型，方便本地开发和后续扩展。

3. **最小依赖**
   直接使用 Node.js 原生 `fetch`，不引入额外的 SDK，降低复杂度。

4. **兼容工具调用**
   正确处理 OpenAI 格式的 `tool_calls`，与现有 ToolRegistry 无缝配合。

## 实现 OpenAICompatibleProvider

新建文件 `packages/core/src/agent/providers/openai-compatible.ts`：

```ts
export interface OpenAICompatibleConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  // ...

  async chat(messages: Message[], tools: ToolDefinition[] = []): Promise<LLMResponse> {
    const body = {
      model: this.model,
      messages: messages.map(/* 转换为 OpenAI 格式 */),
      temperature: this.temperature,
    };

    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    // 解析结果，处理 tool_calls...
  }
}
```

设计要点（关键转换点）：

- 把内部的 `Message` 转为 OpenAI 的 messages 格式
- 把 `ToolDefinition` 转为 OpenAI 的 tools 格式
- 把返回的 `tool_calls` 再转回我们内部的 `ToolCall` 结构

只要这三处转换正确，现有的 Agent 循环和工具执行逻辑就可以直接复用。

## 在 CLI 中切换 Provider

```ts
function createLLM() {
  const provider = process.env.LLM_PROVIDER || "mock";

  if (provider === "openai") {
    return new OpenAICompatibleProvider({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  }

  if (provider === "deepseek") {
    return new OpenAICompatibleProvider({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    });
  }

  return new MockLLMProvider(); // 默认回退
}
```

通过环境变量即可灵活切换，无需改代码。

## 环境变量配置

```bash
# 使用 OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini

# 或使用 DeepSeek
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_MODEL=deepseek-chat
```

建议将 `.env` 加入 `.gitignore`，避免把密钥提交到仓库。

## 测试与验证

- 配置好环境变量后启动 CLI
- 进行普通对话，确认回答质量明显提升
- 测试工具调用（例如「帮我计算 123 + 456」）
- 测试记忆相关能力（「请记住…」「我喜欢喝什么？」）是否仍然正常

## 本章总结

我们成功把真实 LLM 接入了 hachimi，同时保持了架构的清晰：

- Agent、Memory、Tool 的核心逻辑没有被污染
- 通过 Provider 模式实现了可替换的模型层
- 一套代码同时支持 OpenAI 和 DeepSeek

这为后续增加更多模型（Claude、本地 Ollama、其他兼容接口）打下了良好基础。
