---
title: 07. 接入真实大模型：原生 fetch 实现 OpenAI 与 DeepSeek 协议 | hachimi 教程
description: 本章讲解在不引入任何第三方依赖包的情况下，使用原生 fetch 自行封装标准 Chat Completions API 请求与工具调用（Tool Calls）参数映射。
keywords: 接入大模型, OpenAI 协议, DeepSeek API, 原生 fetch, Tool Calling, 接口封装
---

# 07. 接入真实 LLM

## 本章目标

在本章中，我们将正式告别“玩具模拟器” `MockLLMProvider`，接入真正的大语言模型（LLM）API。通过本章的改造，我们的 Agent 将拥有真正的逻辑推理、指令遵循和工具选择能力。

为了同时兼容多种大模型提供商，我们不采用闭源或特定的 SDK，而是实现一个**通用的 OpenAI 兼容协议适配器（OpenAICompatibleProvider）**。它将支持：
- OpenAI 官方 API (如 `gpt-4o-mini`, `gpt-4o`)。
- DeepSeek API (完全兼容 OpenAI 协议标准，性价比极高)。
- 本地 Ollama 部署服务。
- 其他任何实现了 `/v1/chat/completions` 标准接口的提供商。

---

## 设计原则

1. **零第三方 SDK 依赖**：我们不安装 `openai` 官方包，而是直接使用 Node.js 原生的 `fetch` 发起网络请求，这使核心 Harness 变得极其轻量，避开了复杂的依赖更新。
2. **保持对外接口（LLMProvider）的绝对稳定**：Agent 不需要感知底层调用的是 Mock 还是真实的 GPT-4。所有数据结构的差异（如 Tool 调用的参数格式）都在 Provider 内部完成对齐。
3. **安全配置驱动**：通过本地 `.env` 环境变量来管理密钥与接口地址，杜绝将敏感的 API Key 提交到代码库。

---

## 实现 OpenAICompatibleProvider

在核心包中，我们新建文件 `packages/core/src/agent/providers/openai-compatible.ts`。

这个文件主要承担两个职责：
- 将内部统一的 `Message[]` 数组映射转换成 OpenAI 规范要求的 `messages` 数组。
- 发起 POST 请求，并解析返回数据，若含有 `tool_calls`，则将其格式化回我们内部的 `ToolCall` 格式。

### 详细实现代码

```ts
import type { Message, ToolDefinition, LLMResponse, LLMProvider } from "../../types/index.js";

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseURL?: string; // 默认使用 OpenAI 官方地址
  model?: string;
  temperature?: number;
}

export class OpenAICompatibleProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private temperature: number;

  constructor(config: OpenAICompatibleConfig) {
    this.apiKey = config.apiKey;
    // 自动裁剪掉末尾的斜杠，防止拼接 URL 时出错
    this.baseURL = (config.baseURL || "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = config.model || "gpt-4o-mini";
    this.temperature = config.temperature ?? 0.7;
  }

  async chat(messages: Message[], tools: ToolDefinition[] = []): Promise<LLMResponse> {
    // 1. 消息格式映射：转换 role 并附加 tool_call_id
    const openAIMessages = messages.map((m) => ({
      role: m.role === "tool" ? "tool" : m.role,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    }));

    const body: any = {
      model: this.model,
      messages: openAIMessages,
      temperature: this.temperature,
    };

    // 2. 如果存在已注册工具，转换为 OpenAI tools 规范
    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = "auto";
    }

    // 3. 原生 HTTP Fetch 发起请求
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API 响应错误 (状态码 ${res.status}): ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message;

    if (!choice) {
      throw new Error("大模型接口返回数据异常，解析失败");
    }

    // 4. 解析大模型的工具调用意图
    if (choice.tool_calls && choice.tool_calls.length > 0) {
      return {
        content: choice.content || null,
        tool_calls: choice.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          // 大模型返回的参数是 JSON 字符串，我们需要在此反序列化
          arguments: JSON.parse(tc.function.arguments || "{}"),
        })),
      };
    }

    // 5. 普通对话回复
    return {
      content: choice.content || "",
    };
  }
}
```

---

## 统一导出

在 `packages/core/src/index.ts` 中导出我们新增的 Provider，方便外部脚本引用：

```ts
export { OpenAICompatibleProvider } from "./agent/providers/openai-compatible.js";
export type { OpenAICompatibleConfig } from "./agent/providers/openai-compatible.js";
```

---

## 在 CLI 入口中动态切换提供商

我们在 `scripts/chat.ts` 中编写一个工厂函数，根据环境变量无缝构造底层的 LLM 提供商：

```ts
// scripts/chat.ts

function createLLM() {
  const provider = process.env.LLM_PROVIDER || "mock";

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("未检测到环境变量 OPENAI_API_KEY");
    }
    return new OpenAICompatibleProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
  }

  if (provider === "deepseek") {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("未检测到环境变量 DEEPSEEK_API_KEY");
    }
    return new OpenAICompatibleProvider({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    });
  }

  // 默认回退到 Mock 调试提供商，防止无密钥时项目无法启动
  console.log("[LLM] 未配置环境变量，自动启用 MockLLMProvider");
  return new MockLLMProvider();
}
```

---

## 环境变量配置

在项目根目录下，我们创建 `.env` 文件（同时将其写入 `.gitignore`）：

```bash
# ================= 真实 LLM 配置 =================

# 选项：mock | openai | deepseek
LLM_PROVIDER=deepseek

# 如果使用 OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# 如果使用 DeepSeek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
```

为了方便合作开发者，我们可以留一个 `.env.example`：

```bash
# 复制此文件为 .env 并填写你的 API Key
LLM_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
```

---

## 测试与验证

1. 拷贝环境变量文件：`cp .env.example .env`，填入你的真实 API 密钥。
2. 将 `LLM_PROVIDER` 设置为 `deepseek`。
3. 运行交互式 CLI：
   ```bash
   pnpm install
   npx tsx scripts/chat.ts
   ```
4. 在终端向其发问以测试真正的工具执行链：
   > **你:** “帮我算一下 $9876 \times 5432$ 等于多少？”
   > **hachimi:** （触发底层 calculator 工具，执行乘法，返回计算结果）53646432。

---

## 本章总结

通过本章的硬核推进：
- 我们实现了一个纯净的、完全兼容 OpenAI 协议规范的 HTTP 适配器。
- 打通了从大模型返回的 `tool_calls` 参数反序列化至内部格式的闭环。
- 引入了环境变量机制，实现了极简的“多模型切换”。

现在我们的 Agent 终于接入了互联网，有了真正的智慧。在下一章中，我们将为其赋予一套更有序、高扩展的专业技能库——[Skills 系统](08-Skills系统.md)。
