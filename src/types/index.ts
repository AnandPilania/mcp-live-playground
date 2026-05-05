// ── MCP Types ─────────────────────────────────────────────────────────────────

export interface McpParam {
    name: string;
    type: string;
    description: string;
    optional: boolean;
    enumValues?: string[];
    defaultValue?: string;
    min?: string;
    max?: string;
}

export interface McpTool {
    id: string;
    name: string;
    description: string;
    params: McpParam[];
    lang: "ts" | "py";
}

export interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}

export interface McpPrompt {
    name: string;
    description: string;
    arguments: McpParam[];
}

export interface ParsedServer {
    name?: string;
    version?: string;
    tools: McpTool[];
    resources: McpResource[];
    prompts: McpPrompt[];
}

// ── LLM Provider Types ────────────────────────────────────────────────────────

export type LLMProviderType = "anthropic" | "openai" | "ollama" | "openrouter" | "custom";

export interface LLMProvider {
    type: LLMProviderType;
    name: string;
    baseUrl: string;
    apiKey?: string;
    model: string;
    availableModels: string[];
}

export interface LLMMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface LLMResponse {
    content: string;
    model: string;
    provider: string;
    tokensUsed?: number;
    latencyMs?: number;
}

// ── UI Types ──────────────────────────────────────────────────────────────────

export type RightTab = "tools" | "console" | "schema" | "resources";

export interface ConsoleMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    provider?: string;
    latencyMs?: number;
}

export interface SimulationResult {
    content: Array<{ type: string; text: string }>;
    isError: boolean;
}
