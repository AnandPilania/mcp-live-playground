import type { LLMMessage, LLMProvider, LLMResponse, LLMProviderType } from "@/types";

// ── Default provider configs ──────────────────────────────────────────────────

export const DEFAULT_PROVIDERS: Record<LLMProviderType, Omit<LLMProvider, "apiKey">> = {
    anthropic: {
        type: "anthropic",
        name: "Anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-4-5",
        availableModels: [
            "claude-opus-4-5",
            "claude-sonnet-4-5",
            "claude-haiku-4-5",
        ],
    },
    openai: {
        type: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o",
        availableModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    },
    ollama: {
        type: "ollama",
        name: "Ollama (Local)",
        baseUrl: "http://localhost:11434/v1",
        model: "gemma4:31b-cloud",
        availableModels: ["gemma4:31b-cloud", "llama3.1", "mistral", "codellama", "qwen2.5-coder"],
    },
    openrouter: {
        type: "openrouter",
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "meta-llama/llama-3.1-8b-instruct:free",
        availableModels: [
            "meta-llama/llama-3.1-8b-instruct:free",
            "mistralai/mistral-7b-instruct:free",
            "google/gemma-2-9b-it:free",
            "anthropic/claude-3.5-sonnet",
            "openai/gpt-4o",
        ],
    },
    custom: {
        type: "custom",
        name: "Custom (OpenAI-compatible)",
        baseUrl: "http://localhost:8080/v1",
        model: "gemma4:31b-cloud",
        availableModels: ["gemma4:31b-cloud"],
    },
};

// ── Send message via OpenAI-compatible API ────────────────────────────────────
async function sendOpenAICompatible(
    provider: LLMProvider,
    messages: LLMMessage[],
    system?: string
): Promise<LLMResponse> {
    const t0 = performance.now();
    const body: Record<string, unknown> = {
        model: provider.model,
        max_tokens: 1500,
        messages: system
            ? [{ role: "system", content: system }, ...messages]
            : messages,
    };

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (provider.apiKey) {
        headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }
    if (provider.type === "openrouter") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "MCP Live Playground";
    }

    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`${provider.name} error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return {
        content: data.choices?.[0]?.message?.content || "",
        model: data.model || provider.model,
        provider: provider.name,
        tokensUsed: data.usage?.total_tokens,
        latencyMs: Math.round(performance.now() - t0),
    };
}

// ── Send message via Anthropic native API ─────────────────────────────────────
async function sendAnthropic(
    provider: LLMProvider,
    messages: LLMMessage[],
    system?: string
): Promise<LLMResponse> {
    const t0 = performance.now();
    const body: Record<string, unknown> = {
        model: provider.model,
        max_tokens: 1500,
        messages: messages.filter((m) => m.role !== "system"),
    };
    if (system) body.system = system;

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-calls": "true",
    };
    if (provider.apiKey) {
        headers["x-api-key"] = provider.apiKey;
    }

    const res = await fetch(`${provider.baseUrl}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return {
        content: data.content?.filter((b: { type: string }) => b.type === "text")
            .map((b: { text: string }) => b.text).join("") || "",
        model: data.model || provider.model,
        provider: provider.name,
        tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
        latencyMs: Math.round(performance.now() - t0),
    };
}

// ── Main dispatch ─────────────────────────────────────────────────────────────
export async function sendMessage(
    provider: LLMProvider,
    messages: LLMMessage[],
    system?: string
): Promise<LLMResponse> {
    if (provider.type === "anthropic") {
        return sendAnthropic(provider, messages, system);
    }
    return sendOpenAICompatible(provider, messages, system);
}

// ── Storage helpers ───────────────────────────────────────────────────────────
const STORAGE_KEY = "mcp-pg-provider";

export function saveProvider(provider: LLMProvider): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(provider));
    } catch { }
}

export function loadProvider(): LLMProvider | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getDefaultProvider(type: LLMProviderType, apiKey?: string): LLMProvider {
    return { ...DEFAULT_PROVIDERS[type], apiKey };
}
