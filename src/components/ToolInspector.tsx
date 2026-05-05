import { useState } from "react";
import type { McpTool, McpParam } from "@/types";

const TYPE_CLR: Record<string, string> = {
  string: "#00d8ff", str: "#00d8ff",
  number: "#f5a623", int: "#f5a623", float: "#f5a623",
  boolean: "#00e887", bool: "#00e887",
  enum: "#b48efe",
  array: "#79c0ff", list: "#79c0ff",
  object: "#f97583", dict: "#f97583",
  any: "#7a8fa0",
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_CLR[type] || "#7a8fa0";
  return (
    <span style={{
      fontSize: 10, fontFamily: "var(--font-mono)", color,
      background: `${color}18`, border: `1px solid ${color}28`,
      borderRadius: 3, padding: "1px 6px", whiteSpace: "nowrap",
    }}>
      {type}
    </span>
  );
}

function ParamRow({ param }: { param: McpParam }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", flexWrap: "wrap",
      gap: 5, padding: "5px 10px", background: "var(--bg3)", borderRadius: 5,
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 12,
        color: "var(--bright)", minWidth: 120, flexShrink: 0,
      }}>
        {param.name}
      </span>
      <TypeBadge type={param.type} />
      {param.optional && (
        <span style={{
          fontSize: 10, color: "var(--txt3)",
          border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px",
        }}>
          optional
        </span>
      )}
      {param.enumValues && (
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#b48efe" }}>
          [{param.enumValues.join(" | ")}]
        </span>
      )}
      {(param.min || param.max) && (
        <span style={{ fontSize: 10, color: "var(--txt3)", fontFamily: "var(--font-mono)" }}>
          {param.min && `min:${param.min}`}{param.min && param.max && " "}
          {param.max && `max:${param.max}`}
        </span>
      )}
      {param.description && (
        <span style={{ fontSize: 11, color: "var(--txt2)", flex: 1, minWidth: 140, lineHeight: 1.5 }}>
          {param.description}
        </span>
      )}
    </div>
  );
}

interface ToolCardProps {
  tool: McpTool;
  onTest: (tool: McpTool) => void;
}

export function ToolCard({ tool, onTest }: ToolCardProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="fade-in" style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 8, overflow: "hidden", marginBottom: 10,
    }}>
      <div
        onClick={() => setOpen((x) => !x)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", cursor: "pointer", userSelect: "none",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--txt3)" }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--cyan)", fontWeight: 500, flex: 1 }}>
          {tool.name}
        </span>
        <span style={{
          fontSize: 10, fontFamily: "var(--font-mono)",
          color: tool.lang === "py" ? "var(--amber)" : "var(--purple)",
          background: tool.lang === "py" ? "rgba(245,166,35,0.12)" : "rgba(180,142,254,0.12)",
          border: `1px solid ${tool.lang === "py" ? "rgba(245,166,35,0.25)" : "rgba(180,142,254,0.25)"}`,
          borderRadius: 3, padding: "2px 7px",
        }}>
          {tool.lang === "py" ? "Python" : "TypeScript"}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onTest(tool); }}
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
            color: "var(--bg0)", background: "var(--cyan)",
            borderRadius: 4, padding: "3px 10px",
          }}
        >
          TEST
        </button>
      </div>

      {open && (
        <div style={{ padding: "10px 14px" }}>
          <p style={{ fontSize: 12, color: "var(--txt2)", lineHeight: 1.6, marginBottom: 8 }}>
            {tool.description}
          </p>
          {tool.params.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tool.params.map((p) => <ParamRow key={p.name} param={p} />)}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: "var(--txt3)", fontStyle: "italic" }}>
              No parameters
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolInspectorProps {
  tools: McpTool[];
  onTest: (tool: McpTool) => void;
}

export default function ToolInspector({ tools, onTest }: ToolInspectorProps) {
  if (tools.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "55%", gap: 12, opacity: 0.4,
        textAlign: "center", padding: 20,
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" stroke="var(--border2)" strokeWidth="2" fill="none" />
          <circle cx="22" cy="22" r="7" stroke="var(--txt3)" strokeWidth="1.5" fill="none" />
        </svg>
        <div>
          <div style={{ color: "var(--txt2)", fontWeight: 600, marginBottom: 5 }}>
            No tools detected
          </div>
          <div style={{ fontSize: 12, color: "var(--txt3)", lineHeight: 1.7 }}>
            Use{" "}
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>
              server.tool()
            </code>
            {" "}or{" "}
            <code style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>
              @mcp.tool()
            </code>
            <br />
            to define your first tool
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 14 }}>
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} onTest={onTest} />
      ))}
    </div>
  );
}
