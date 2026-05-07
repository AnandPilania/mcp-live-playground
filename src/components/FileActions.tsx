import { useRef, useState } from "react";

interface FileActionsProps {
  code: string;
  activeTemplate: string;
  onImport: (code: string, filename: string) => void;
}

function detectLang(code: string): "ts" | "py" {
  return /^\s*(?:from|import)\s+\w+.*\n.*def\s+\w+/ms.test(code) ? "py" : "ts";
}

export default function FileActions({ code, activeTemplate, onImport }: FileActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // ── Export as file ──────────────────────────────────────────────────────────
  const exportFile = () => {
    const lang = detectLang(code);
    const ext  = lang === "py" ? "py" : "ts";
    const slug = activeTemplate.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `${slug}.${ext}`;

    const blob = new Blob([code], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filename}`);
  };

  // ── Copy to clipboard ───────────────────────────────────────────────────────
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      showToast("Copied to clipboard");
    } catch {
      showToast("Copy failed");
    }
  };

  // ── Export as JSON project snapshot ────────────────────────────────────────
  const exportSnapshot = () => {
    const snapshot = {
      version: "1",
      exportedAt: new Date().toISOString(),
      template: activeTemplate,
      lang: detectLang(code),
      code,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `mcp-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Snapshot exported");
  };

  // ── Import file ─────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErr(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      if (!raw) return;

      // JSON snapshot
      if (file.name.endsWith(".json")) {
        try {
          const snap = JSON.parse(raw);
          if (typeof snap.code !== "string") throw new Error("Invalid snapshot: missing 'code' field");
          onImport(snap.code, snap.template || file.name);
          showToast(`Imported snapshot: ${snap.template || file.name}`);
        } catch (err) {
          setImportErr(err instanceof Error ? err.message : "Invalid JSON snapshot");
        }
        return;
      }

      // Raw .ts / .py / .js file
      if (/\.(ts|js|tsx|py)$/.test(file.name)) {
        onImport(raw, file.name.replace(/\.[^.]+$/, ""));
        showToast(`Imported ${file.name}`);
        return;
      }

      setImportErr("Unsupported file type. Import a .ts, .py, or .json snapshot.");
    };
    reader.readAsText(file);

    // Reset so same file can be re-imported
    e.target.value = "";
  };

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    padding: "3px 9px", fontSize: 11, fontWeight: 600,
    color: "var(--txt2)", border: "1px solid var(--border)",
    borderRadius: 4, background: "var(--bg2)", transition: "all .15s",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 5 }}>
      {/* Copy */}
      <button
        onClick={copyCode}
        title="Copy code to clipboard"
        style={btnStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--cyan)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--cyan2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--txt2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <rect x="5" y="5" width="9" height="11" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
        COPY
      </button>

      {/* Export code file */}
      <button
        onClick={exportFile}
        title="Export as .ts or .py file"
        style={btnStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--green)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--green)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--txt2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v8M5 7l3 3 3-3M2 12v2h12v-2"/>
        </svg>
        EXPORT
      </button>

      {/* Export snapshot */}
      <button
        onClick={exportSnapshot}
        title="Export full JSON snapshot (includes template name)"
        style={btnStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--amber)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--amber)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--txt2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="1"/>
          <path d="M5 7h6M5 10h4"/>
        </svg>
        SNAPSHOT
      </button>

      {/* Import */}
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Import .ts, .py, or .json snapshot"
        style={btnStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--purple)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--purple)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--txt2)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 10V2M5 5l3-3 3 3M2 12v2h12v-2"/>
        </svg>
        IMPORT
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ts,.js,.tsx,.py,.json"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Import error */}
      {importErr && (
        <span style={{ fontSize: 10.5, color: "var(--red)", maxWidth: 200 }}>{importErr}</span>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", right: 0,
          background: "var(--bg3)", border: "1px solid var(--border2)",
          borderRadius: 5, padding: "5px 10px",
          fontSize: 11, color: "var(--green)", whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          animation: "fadeIn .15s ease",
          zIndex: 50,
        }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
