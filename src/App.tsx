import { useState, useCallback, useRef } from "react";
import Editor from "@/components/Editor";
import ToolInspector from "@/components/ToolInspector";
import Console from "@/components/Console";
import SchemaView from "@/components/SchemaView";
import TestModal from "@/components/TestModal";
import ProviderSettings from "@/components/ProviderSettings";
import { useParser } from "@/hooks/useParser";
import { useProvider } from "@/hooks/useProvider";
import { TEMPLATES, DEFAULT_TEMPLATE } from "@/templates";
import type { McpTool, RightTab } from "@/types";

const STORAGE_CODE_KEY = "mcp-pg-code";

function loadSavedCode(): string {
  try {
    return localStorage.getItem(STORAGE_CODE_KEY) || DEFAULT_TEMPLATE.code;
  } catch {
    return DEFAULT_TEMPLATE.code;
  }
}

export default function App() {
  const [code,          setCode]          = useState<string>(loadSavedCode);
  const [activeTemplate,setActiveTemplate]= useState<string>(DEFAULT_TEMPLATE.name);
  const [tab,           setTab]           = useState<RightTab>("tools");
  const [split,         setSplit]         = useState<number>(52);
  const [testTool,      setTestTool]      = useState<McpTool | null>(null);
  const [showSettings,  setShowSettings]  = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging     = useRef<boolean>(false);

  const { parsed, parseMs, debouncedCode } = useParser(code);
  const { provider, updateProvider, switchProviderType } = useProvider();

  const handleCodeChange = useCallback((v: string) => {
    setCode(v);
    try { localStorage.setItem(STORAGE_CODE_KEY, v); } catch {}
  }, []);

  const loadTemplate = (name: string) => {
    const t = TEMPLATES.find((t) => t.name === name);
    if (!t) return;
    setCode(t.code);
    setActiveTemplate(name);
    try { localStorage.setItem(STORAGE_CODE_KEY, t.code); } catch {}
  };

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.max(20, Math.min(80, pct)));
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
  }, []);

  const TABS: { id: RightTab; label: string; badge?: number }[] = [
    { id: "tools",   label: "TOOLS",   badge: parsed.tools.length },
    { id: "console", label: "CONSOLE" },
    { id: "schema",  label: "SCHEMA"  },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* ── Top Bar ── */}
      <div style={{
        height: 48, flexShrink: 0, display: "flex", alignItems: "center",
        gap: 10, padding: "0 14px",
        borderBottom: "1px solid var(--border)", background: "var(--bg1)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginRight: 4 }}>
          <svg width="20" height="20" viewBox="0 0 22 22">
            <polygon points="11,1 20,6 20,16 11,21 2,16 2,6" stroke="var(--cyan)" strokeWidth="1.5" fill="none" />
            <polygon points="11,6 16,9 16,15 11,18 6,15 6,9" fill="rgba(0,216,255,0.15)" stroke="rgba(0,216,255,0.5)" strokeWidth="1" />
            <circle cx="11" cy="11" r="2.5" fill="var(--cyan)" />
          </svg>
          <span style={{ fontWeight: 800, fontSize: 14, color: "var(--bright)", letterSpacing: 0.3 }}>MCP</span>
          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--cyan)", letterSpacing: 2.5 }}>LIVE</span>
        </div>

        {/* Template selector */}
        <div style={{ position: "relative" }}>
          <select
            value={activeTemplate}
            onChange={(e) => loadTemplate(e.target.value)}
            style={{
              background: "var(--bg2)", border: "1px solid var(--border2)",
              borderRadius: 5, padding: "4px 26px 4px 9px",
              fontSize: 11.5, color: "var(--txt)", fontWeight: 600, appearance: "none",
            }}
          >
            {TEMPLATES.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
          <span style={{
            position: "absolute", right: 7, top: "50%",
            transform: "translateY(-50%)", fontSize: 9,
            color: "var(--txt3)", pointerEvents: "none",
          }}>▾</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Live status */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5, padding: "3px 10px",
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: 10, fontSize: 11,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: parsed.tools.length > 0 ? "var(--green)" : "var(--txt3)",
          }} />
          <span style={{ color: "var(--txt2)", fontWeight: 600 }}>
            {parsed.tools.length} tool{parsed.tools.length !== 1 ? "s" : ""}
          </span>
        </div>

        {parseMs !== null && (
          <span style={{ fontSize: 10.5, color: "var(--txt3)", fontFamily: "var(--font-mono)" }}>
            {parseMs}ms
          </span>
        )}

        {/* Provider button */}
        <button
          onClick={() => setShowSettings(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            background: "var(--bg2)", border: "1px solid var(--border2)",
            borderRadius: 5, fontSize: 11.5, color: "var(--txt2)",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--cyan2)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--cyan)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border2)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--txt2)";
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
            {provider.name}
          </span>
          <span style={{ color: "var(--txt3)", fontSize: 10 }}>▾</span>
        </button>

        {/* Docs link */}
        <a
          href="https://modelcontextprotocol.io/docs"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11, color: "var(--txt3)", textDecoration: "none",
            border: "1px solid var(--border)", borderRadius: 4,
            padding: "3px 8px", transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLAnchorElement).style.color = "var(--cyan)";
            (e.target as HTMLAnchorElement).style.borderColor = "var(--cyan2)";
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLAnchorElement).style.color = "var(--txt3)";
            (e.target as HTMLAnchorElement).style.borderColor = "var(--border)";
          }}
        >
          DOCS ↗
        </a>
      </div>

      {/* ── Split Pane ── */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left — Editor */}
        <div style={{ width: `${split}%`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Editor header */}
          <div style={{
            height: 34, flexShrink: 0, display: "flex", alignItems: "center",
            gap: 8, padding: "0 12px",
            borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)",
            background: "var(--bg1)",
          }}>
            <div style={{ display: "flex", gap: 5 }}>
              {["#ff4d6d", "#f5a623", "var(--green)"].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "var(--txt3)", fontFamily: "var(--font-mono)", flex: 1 }}>
              {activeTemplate}.{TEMPLATES.find(t => t.name === activeTemplate)?.lang === "py" ? "py" : "ts"}
            </span>
            <button
              onClick={() => { if (window.confirm("Reset to template code?")) loadTemplate(activeTemplate); }}
              style={{
                fontSize: 10, color: "var(--txt3)",
                border: "1px solid var(--border)", borderRadius: 3,
                padding: "2px 7px", background: "var(--bg2)", transition: "color .15s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.color = "var(--red)")}
              onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.color = "var(--txt3)")}
            >
              RESET
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden", borderRight: "1px solid var(--border)" }}>
            <Editor
              value={code}
              onChange={handleCodeChange}
              language={TEMPLATES.find(t => t.name === activeTemplate)?.lang || "ts"}
            />
          </div>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={startDrag}
          style={{
            width: 4, flexShrink: 0,
            background: "var(--border)", cursor: "col-resize", transition: "background .15s",
          }}
          onMouseEnter={(e) => ((e.target as HTMLDivElement).style.background = "var(--cyan2)")}
          onMouseLeave={(e) => ((e.target as HTMLDivElement).style.background = "var(--border)")}
        />

        {/* Right — Live Preview */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{
            height: 34, flexShrink: 0, display: "flex", alignItems: "stretch",
            borderBottom: "1px solid var(--border)", background: "var(--bg1)",
          }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "0 14px", fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                  color: tab === t.id ? "var(--bright)" : "var(--txt3)",
                  borderBottom: tab === t.id ? "2px solid var(--cyan)" : "2px solid transparent",
                  background: "none", transition: "all .15s",
                }}
              >
                {t.label}
                {t.badge !== undefined && (
                  <span style={{
                    fontSize: 10, minWidth: 16, textAlign: "center",
                    background: tab === t.id ? "var(--cyan)" : "var(--bg3)",
                    color: tab === t.id ? "var(--bg0)" : "var(--txt3)",
                    borderRadius: 8, padding: "0 5px",
                  }}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {tab === "tools" && (
              <ToolInspector tools={parsed.tools} onTest={setTestTool} />
            )}
            {tab === "console" && (
              <Console tools={parsed.tools} code={debouncedCode} provider={provider} />
            )}
            {tab === "schema" && (
              <SchemaView parsed={parsed} />
            )}
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div style={{
        height: 24, flexShrink: 0, display: "flex", alignItems: "center", gap: 16,
        padding: "0 14px", borderTop: "1px solid var(--border)",
        background: "var(--bg1)", fontSize: 10.5, color: "var(--txt3)",
        fontFamily: "var(--font-mono)",
      }}>
        <span style={{ color: parsed.tools.length > 0 ? "var(--green)" : "var(--txt3)" }}>
          ● {parsed.tools.length} tools · {parsed.resources.length} resources · {parsed.prompts.length} prompts
        </span>
        <span>Ln {code.split("\n").length}</span>
        <span>{code.length} chars</span>
        <div style={{ flex: 1 }} />
        <span>MCP SDK v1.x</span>
        <span style={{ color: "var(--cyan2)" }}>⚡ Live</span>
      </div>

      {/* ── Modals ── */}
      {testTool && (
        <TestModal
          tool={testTool}
          provider={provider}
          onClose={() => setTestTool(null)}
        />
      )}
      {showSettings && (
        <ProviderSettings
          provider={provider}
          onUpdate={updateProvider}
          onSwitchType={switchProviderType}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
