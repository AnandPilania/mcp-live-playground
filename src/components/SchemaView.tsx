import { useMemo } from "react";
import { generateJsonSchema } from "@/lib/parser";
import type { ParsedServer } from "@/types";

interface SchemaViewProps {
  parsed: ParsedServer;
}

export default function SchemaView({ parsed }: SchemaViewProps) {
  const schema = useMemo(() => generateJsonSchema(parsed), [parsed]);
  const raw = JSON.stringify(schema, (_, v) => (v === undefined ? undefined : v), 2);

  const copy = () => {
    navigator.clipboard.writeText(raw).catch(() => {});
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 12,
      }}>
        <div>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1,
            textTransform: "uppercase", color: "var(--txt2)",
          }}>
            JSON Schema
          </span>
          <span style={{ fontSize: 10, color: "var(--txt3)", marginLeft: 8 }}>
            {parsed.tools.length} tools · {parsed.resources.length} resources · {parsed.prompts.length} prompts
          </span>
        </div>
        <button
          onClick={copy}
          style={{
            fontSize: 11, color: "var(--cyan)",
            border: "1px solid var(--cyan2)", borderRadius: 4,
            padding: "3px 10px", background: "var(--cyan-dim)", fontWeight: 700,
          }}
        >
          COPY
        </button>
      </div>
      <pre style={{
        fontFamily: "var(--font-mono)", fontSize: 12,
        lineHeight: 1.65, color: "var(--txt)",
        whiteSpace: "pre", overflowX: "auto",
      }}>
        {raw}
      </pre>
    </div>
  );
}
