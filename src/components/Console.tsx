import { useState, useRef, useEffect, useId } from "react";
import { sendMessage } from "@/providers";
import type { LLMProvider, McpTool, ConsoleMessage } from "@/types";

interface ConsoleProps {
  tools: McpTool[];
  code: string;
  provider: LLMProvider;
}

function buildSystemPrompt(tools: McpTool[], code: string): string {
  const defs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    params: t.params.map((p) => ({
      name: p.name, type: p.type,
      description: p.description,
      optional: p.optional,
      enumValues: p.enumValues,
    })),
  }));

  return `You are an expert MCP (Model Context Protocol) tool tester, debugger, and documentation assistant.

LIVE TOOL DEFINITIONS (parsed from the user's editor in real-time):
${JSON.stringify(defs, null, 2)}

SOURCE CODE (first 3000 chars):
\`\`\`
${code.slice(0, 3000)}
\`\`\`

Your capabilities:
1. TEST tools: generate realistic inputs + simulate a proper MCP JSON response
2. EDGE CASES: boundary values, invalid types, null/empty, very long strings, SQL injection attempts
3. DEBUG: find bugs, security issues (path traversal, injection), missing error handling, type mismatches
4. EXPLAIN: describe parameters, return types, and usage examples
5. GENERATE: boilerplate for new tools based on description

Always be concrete, technical, and developer-focused.
Use markdown code blocks (with language) for JSON, TypeScript, Python output.
For simulated tool responses, always use this exact MCP format:
\`\`\`json
{
  "content": [{ "type": "text", "text": "..." }],
  "isError": false
}
\`\`\``;
}

function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const lang = part.match(/^```(\w*)/)?.[1] || "";
      const inner = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
      return (
        <pre
          key={i}
          style={{
            margin: "6px 0", padding: "10px 12px",
            background: "var(--bg0)", border: "1px solid var(--border)",
            borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11.5,
            lineHeight: 1.6, overflowX: "auto", color: "var(--txt)",
            whiteSpace: "pre",
          }}
        >
          {lang && (
            <span style={{ display: "block", fontSize: 10, color: "var(--txt3)", marginBottom: 6 }}>
              {lang}
            </span>
          )}
          {inner}
        </pre>
      );
    }
    return (
      <span
        key={i}
        dangerouslySetInnerHTML={{
          __html: part
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*([^*]+)\*\*/g, "<strong style='color:var(--bright)'>$1</strong>")
            .replace(/`([^`]+)`/g,
              "<code style='font-family:var(--font-mono);font-size:12px;color:var(--cyan);background:var(--bg3);padding:1px 5px;border-radius:3px'>$1</code>")
            .replace(/\n/g, "<br/>"),
        }}
      />
    );
  });
}

const QUICK_ACTIONS = [
  "Test all tools",
  "Generate edge cases",
  "Check for security issues",
  "Show example responses",
  "Generate TypeScript types",
];

export default function Console({ tools, code, provider }: ConsoleProps) {
  const idPrefix = useId();
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: `${idPrefix}-0`,
      role: "assistant",
      content:
        "👋 **MCP Test Console** ready.\n\nI'll help you test tools, generate edge cases, and debug your server code. I'm aware of your live tool definitions.\n\nTry asking: `test get_weather with city='Tokyo'` or click a quick action below.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setError(null);

    const userMsg: ConsoleMessage = {
      id: `${idPrefix}-${Date.now()}`,
      role: "user",
      content: q,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const history = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const response = await sendMessage(
        provider,
        [...history, { role: "user", content: q }],
        buildSystemPrompt(tools, code)
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `${idPrefix}-${Date.now()}-r`,
          role: "assistant",
          content: response.content,
          timestamp: Date.now(),
          provider: response.provider,
          latencyMs: response.latencyMs,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `${idPrefix}-${Date.now()}-err`,
          role: "assistant",
          content: `⚠️ **Error:** ${msg}\n\nCheck your API key and provider settings in the toolbar.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {tools.length === 0 && (
        <div style={{
          padding: "7px 14px", background: "rgba(245,166,35,0.08)",
          borderBottom: "1px solid rgba(245,166,35,0.2)",
          fontSize: 11, color: "var(--amber)",
        }}>
          ⚠ No tools detected — add tools in the editor and the console will pick them up automatically
        </div>
      )}

      {/* Provider badge */}
      <div style={{
        padding: "5px 14px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 6,
        background: "var(--bg2)",
      }}>
        <span style={{ fontSize: 10, color: "var(--txt3)" }}>via</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: "var(--cyan)",
          fontFamily: "var(--font-mono)",
        }}>
          {provider.name} / {provider.model}
        </span>
        {error && (
          <span style={{ fontSize: 10, color: "var(--red)", marginLeft: "auto" }}>
            ● Connection error
          </span>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: "auto", padding: 14,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="fade-in"
            style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              flexDirection: msg.role === "user" ? "row-reverse" : "row",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
              background: msg.role === "user" ? "var(--cyan-dim)" : "var(--bg3)",
              border: `1px solid ${msg.role === "user" ? "var(--cyan2)" : "var(--border)"}`,
              color: msg.role === "user" ? "var(--cyan)" : "var(--txt2)",
            }}>
              {msg.role === "user" ? "U" : "AI"}
            </div>
            <div style={{
              maxWidth: "85%",
              background: msg.role === "user" ? "var(--cyan-dim)" : "var(--bg2)",
              border: `1px solid ${msg.role === "user" ? "var(--cyan2)" : "var(--border)"}`,
              borderRadius: msg.role === "user" ? "10px 2px 10px 10px" : "2px 10px 10px 10px",
              padding: "9px 13px",
              fontSize: 12.5, lineHeight: 1.7, color: "var(--txt)",
            }}>
              {renderContent(msg.content)}
              {msg.latencyMs && (
                <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 5 }}>
                  {msg.latencyMs}ms · {msg.provider}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg3)", border: "1px solid var(--border)",
              color: "var(--txt2)", fontSize: 11, fontWeight: 700,
            }}>
              AI
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className="pulse"
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--cyan)", animationDelay: `${j * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div style={{
        padding: "0 14px 8px",
        display: "flex", gap: 5, flexWrap: "wrap",
      }}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a}
            onClick={() => send(a)}
            style={{
              fontSize: 10.5, color: "var(--txt2)",
              border: "1px solid var(--border)", borderRadius: 10,
              padding: "3px 10px", background: "var(--bg2)", transition: "all .15s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.color = "var(--cyan)";
              (e.target as HTMLButtonElement).style.borderColor = "var(--cyan2)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.color = "var(--txt2)";
              (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "0 14px 14px", display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={`Ask ${provider.name} to test a tool, debug, or generate code…`}
          style={{
            flex: 1, background: "var(--bg2)",
            border: "1px solid var(--border)", borderRadius: 6,
            padding: "9px 12px", fontSize: 12.5, color: "var(--bright)",
            transition: "border-color .15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--cyan2)")}
          onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || busy}
          style={{
            background: input.trim() && !busy ? "var(--cyan)" : "var(--bg3)",
            color: input.trim() && !busy ? "var(--bg0)" : "var(--txt3)",
            borderRadius: 6, padding: "9px 16px",
            fontSize: 12, fontWeight: 700, letterSpacing: 0.5, transition: "all .15s",
          }}
        >
          {busy ? "…" : "SEND"}
        </button>
      </div>
    </div>
  );
}
