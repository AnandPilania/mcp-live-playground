import { useState } from "react";
import { sendMessage } from "@/providers";
import type { McpTool, LLMProvider, SimulationResult } from "@/types";

const TYPE_CLR: Record<string, string> = {
  string: "#00d8ff", str: "#00d8ff",
  number: "#f5a623", int: "#f5a623", float: "#f5a623",
  boolean: "#00e887", bool: "#00e887",
  enum: "#b48efe", any: "#7a8fa0",
};

interface TestModalProps {
  tool: McpTool;
  provider: LLMProvider;
  onClose: () => void;
}

export default function TestModal({ tool, provider, onClose }: TestModalProps) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(
      tool.params.map((p) => [p.name, p.defaultValue ?? (p.enumValues?.[0] ?? "")])
    )
  );
  const [result, setResult]   = useState<SimulationResult | null>(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const response = await sendMessage(
        provider,
        [{
          role: "user",
          content: `Simulate MCP tool execution.
Tool name: "${tool.name}"
Description: "${tool.description}"
Input arguments: ${JSON.stringify(vals, null, 2)}

Respond ONLY with valid JSON in this exact format (no markdown wrapper, no extra text):
{"content":[{"type":"text","text":"<realistic, detailed tool output here>"}],"isError":false}`,
        }]
      );

      const raw = response.content.trim();
      // Strip markdown code fences if the model added them anyway
      const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      try {
        setResult(JSON.parse(cleaned));
      } catch {
        setResult({ content: [{ type: "text", text: raw }], isError: false });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="fade-in"
        style={{
          width: 520, maxHeight: "88vh", overflow: "auto",
          background: "var(--bg1)", border: "1px solid var(--border2)",
          borderRadius: 10, padding: 22,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--txt3)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
              Simulate Tool
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--cyan)", fontWeight: 600 }}>
              {tool.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--txt2)", marginTop: 4, lineHeight: 1.5, maxWidth: 380 }}>
              {tool.description}
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--txt3)", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Provider badge */}
        <div style={{
          fontSize: 10, color: "var(--txt3)",
          marginBottom: 14, fontFamily: "var(--font-mono)",
        }}>
          via {provider.name} / {provider.model}
        </div>

        {/* Parameters */}
        {tool.params.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {tool.params.map((p) => (
              <div key={p.name}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--bright)" }}>
                    {p.name}
                  </span>
                  <span style={{
                    fontSize: 10, fontFamily: "var(--font-mono)",
                    color: TYPE_CLR[p.type] || "#7a8fa0",
                    background: `${TYPE_CLR[p.type] || "#7a8fa0"}18`,
                    border: `1px solid ${TYPE_CLR[p.type] || "#7a8fa0"}28`,
                    borderRadius: 3, padding: "1px 5px",
                  }}>
                    {p.type}
                  </span>
                  {p.optional && (
                    <span style={{ fontSize: 10, color: "var(--txt3)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px" }}>
                      optional
                    </span>
                  )}
                </div>
                {p.description && (
                  <div style={{ fontSize: 11, color: "var(--txt2)", marginBottom: 5 }}>{p.description}</div>
                )}
                {p.enumValues ? (
                  <select
                    value={vals[p.name]}
                    onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))}
                    style={{
                      width: "100%", background: "var(--bg2)",
                      border: "1px solid var(--border)", borderRadius: 5,
                      padding: "7px 10px", fontSize: 12, color: "var(--txt)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {p.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input
                    value={vals[p.name]}
                    onChange={(e) => setVals((v) => ({ ...v, [p.name]: e.target.value }))}
                    placeholder={p.defaultValue ?? `Enter ${p.name}…`}
                    style={{
                      width: "100%", background: "var(--bg2)",
                      border: "1px solid var(--border)", borderRadius: 5,
                      padding: "7px 10px", fontSize: 12, color: "var(--bright)",
                      fontFamily: "var(--font-mono)", transition: "border-color .15s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--cyan2)")}
                    onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--txt3)", marginBottom: 16, fontStyle: "italic" }}>
            This tool takes no parameters.
          </p>
        )}

        {/* Run button */}
        <button
          onClick={run}
          disabled={busy}
          style={{
            width: "100%", padding: "11px",
            background: busy ? "var(--bg3)" : "var(--cyan)",
            color: busy ? "var(--txt3)" : "var(--bg0)",
            borderRadius: 6, fontSize: 13, fontWeight: 700,
            letterSpacing: 0.5, transition: "all .15s",
          }}
        >
          {busy ? "SIMULATING…" : "▶  RUN SIMULATION"}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.3)",
            borderRadius: 6, fontSize: 12, color: "var(--red)",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
              textTransform: "uppercase", marginBottom: 8,
              color: result.isError ? "var(--red)" : "var(--green)",
            }}>
              {result.isError ? "⚠ Error Response" : "✓ Tool Response"}
            </div>
            <pre style={{
              background: "var(--bg0)", border: "1px solid var(--border)",
              borderRadius: 6, padding: 12, fontFamily: "var(--font-mono)",
              fontSize: 12, lineHeight: 1.65, color: "var(--txt)",
              overflowX: "auto", whiteSpace: "pre-wrap",
              maxHeight: 300, overflow: "auto",
            }}>
              {result.content?.[0]?.text ?? JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
