# MCP Live Playground

> A CodePen-style live IDE for building, testing, and debugging [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers — **LLM agnostic**.

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-5-purple)

---

## Features

- **Live code editor** with full syntax highlighting (CodeMirror 6), TypeScript & Python support
- **Real-time parser** — tools, resources, and prompts are detected as you type (< 1ms)
- **Tool Inspector** — shows every parameter with type, description, constraints, and enum values
- **AI Test Console** — chat with any LLM to test tools, generate edge cases, and debug
- **Simulation Modal** — fill in parameters and get a realistic simulated tool response
- **JSON Schema generator** — auto-generates full MCP-compatible JSON Schema from your code
- **LLM Agnostic** — works with Anthropic, OpenAI, Ollama (local), OpenRouter, or any OpenAI-compatible API
- **Resizable split pane**, localStorage persistence, 5 built-in templates

---

## Quick Start

```bash
git clone https://github.com/anandpilania/mcp-live-playground
cd mcp-live-playground
npm install
npm run dev
```

Open `http://localhost:5178`.

---

## Supported LLM Providers

| Provider       | API Key Required          | Notes                                      |
| -------------- | ------------------------- | ------------------------------------------ |
| **Anthropic**  | Yes                       | Claude Sonnet, Opus, Haiku                 |
| **OpenAI**     | Yes                       | GPT-4o, GPT-4-turbo, etc.                  |
| **Ollama**     | No                        | Local models (llama3, mistral, codellama…) |
| **OpenRouter** | Yes (free tier available) | 200+ models including free ones            |
| **Custom**     | Optional                  | Any OpenAI-compatible endpoint             |

Click the provider button in the toolbar to configure your API key and model.
Keys are stored **only in your browser's localStorage** and never sent anywhere other than the provider's API directly.

---

## Templates

| Template            | Language   | Description                                                   |
| ------------------- | ---------- | ------------------------------------------------------------- |
| Weather + Translate | TypeScript | Open-Meteo weather API + translation                          |
| Database Tools      | TypeScript | Safe PostgreSQL SELECT queries + schema inspection            |
| File System         | TypeScript | Sandboxed file read/write/list with path traversal protection |
| Python (FastMCP)    | Python     | Web search, sentiment analysis, image generation              |
| Empty Server        | TypeScript | Blank starter                                                 |

---

## Adding a New Template

Edit `src/templates/index.ts` and add a new entry to the `TEMPLATES` array:

```ts
{
  name: "My Template",
  lang: "ts",
  description: "What it does",
  code: `...your MCP server code...`,
}
```

---

## Extending the Parser

The parser in `src/lib/parser.ts` uses regex to extract tool definitions from code. It currently supports:

- TypeScript: `server.tool("name", "desc", { schema }, handler)`
- Python: `@mcp.tool()` + `def name(...)` + docstring

To add support for more patterns, extend `parseTsTools` or add a new language parser and call it from `parseServer`.

---

## Adding a New LLM Provider

Edit `src/providers/index.ts`:

1. Add your provider type to `LLMProviderType` in `src/types/index.ts`
2. Add its default config to `DEFAULT_PROVIDERS`
3. If it's not OpenAI-compatible, add a new send function and dispatch it in `sendMessage`

---

## Building for Production

```bash
npm run build     # outputs to dist/
npm run preview   # preview the build locally
```

---

## License

MIT — use it, fork it, open-source it.
