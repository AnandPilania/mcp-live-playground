import { useState } from "react";
import { DEFAULT_PROVIDERS } from "@/providers";
import type { LLMProvider, LLMProviderType } from "@/types";

interface ProviderSettingsProps {
  provider: LLMProvider;
  onUpdate: (updates: Partial<LLMProvider>) => void;
  onSwitchType: (type: LLMProviderType) => void;
  onClose: () => void;
}

const PROVIDER_ICONS: Record<LLMProviderType, string> = {
  anthropic: "🔶",
  openai: "🟢",
  ollama: "🦙",
  openrouter: "🌐",
  custom: "⚙️",
};

export default function ProviderSettings({ provider, onUpdate, onSwitchType, onClose }: ProviderSettingsProps) {
  const [localKey, setLocalKey] = useState(provider.apiKey || "");
  const [localUrl, setLocalUrl] = useState(provider.baseUrl);
  const [localModel, setLocalModel] = useState(provider.model);
  const [localCustomModel, setLocalCustomModel] = useState("");
  const [saved, setSaved] = useState(false);

  const save = () => {
    onUpdate({
      apiKey: localKey || undefined,
      baseUrl: localUrl,
      model: localModel || localCustomModel,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          width: 480, background: "var(--bg1)",
          border: "1px solid var(--border2)", borderRadius: 10, padding: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--bright)" }}>LLM Provider</div>
            <div style={{ fontSize: 12, color: "var(--txt2)", marginTop: 2 }}>
              Configure which model powers the Console and Test Simulator
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--txt3)", fontSize: 18, padding: 4 }}>✕</button>
        </div>

        {/* Provider type selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--txt2)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
            Provider
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(Object.keys(DEFAULT_PROVIDERS) as LLMProviderType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  onSwitchType(t);
                  setLocalUrl(DEFAULT_PROVIDERS[t].baseUrl);
                  setLocalModel(DEFAULT_PROVIDERS[t].model);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px",
                  background: provider.type === t ? "var(--cyan-dim)" : "var(--bg2)",
                  border: `1px solid ${provider.type === t ? "var(--cyan2)" : "var(--border)"}`,
                  borderRadius: 6, fontSize: 12, color: provider.type === t ? "var(--cyan)" : "var(--txt2)",
                  fontWeight: provider.type === t ? 700 : 400, transition: "all .15s",
                  textAlign: "left",
                }}
              >
                <span>{PROVIDER_ICONS[t]}</span>
                <span>{DEFAULT_PROVIDERS[t].name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        {provider.type !== "ollama" && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--txt2)", letterSpacing: 0.8, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              API Key
            </label>
            <input
              type="password"
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              placeholder={provider.type === "ollama" ? "Not required" : "sk-…"}
              style={{
                width: "100%", background: "var(--bg2)",
                border: "1px solid var(--border)", borderRadius: 5,
                padding: "8px 10px", fontSize: 12, color: "var(--bright)",
                fontFamily: "var(--font-mono)", transition: "border-color .15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--cyan2)")}
              onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
            />
            <div style={{ fontSize: 10, color: "var(--txt3)", marginTop: 4 }}>
              Stored in localStorage only. Never sent anywhere except directly to {provider.name}.
            </div>
          </div>
        )}

        {/* Base URL (for Ollama / Custom) */}
        {(provider.type === "ollama" || provider.type === "custom") && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--txt2)", letterSpacing: 0.8, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Base URL
            </label>
            <input
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              style={{
                width: "100%", background: "var(--bg2)",
                border: "1px solid var(--border)", borderRadius: 5,
                padding: "8px 10px", fontSize: 12, color: "var(--bright)",
                fontFamily: "var(--font-mono)", transition: "border-color .15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--cyan2)")}
              onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
            />
          </div>
        )}

        {/* Model */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--txt2)", letterSpacing: 0.8, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Model
          </label>
          <select
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            style={{
              width: "100%", background: "var(--bg2)",
              border: "1px solid var(--border)", borderRadius: 5,
              padding: "8px 10px", fontSize: 12, color: "var(--txt)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {DEFAULT_PROVIDERS[provider.type].availableModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {(provider.type === "ollama" || provider.type === "custom") && (
            <input
              value={localCustomModel}
              onChange={(e) => setLocalCustomModel(e.target.value)}
              placeholder="Or enter a custom model name…"
              style={{
                width: "100%", background: "var(--bg2)",
                border: "1px solid var(--border)", borderRadius: 5,
                padding: "8px 10px", fontSize: 12, color: "var(--bright)",
                fontFamily: "var(--font-mono)", marginTop: 6,
                transition: "border-color .15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--cyan2)")}
              onBlur={(e)  => (e.target.style.borderColor = "var(--border)")}
            />
          )}
        </div>

        <button
          onClick={save}
          style={{
            width: "100%", padding: "10px",
            background: saved ? "var(--green)" : "var(--cyan)",
            color: "var(--bg0)", borderRadius: 6,
            fontSize: 13, fontWeight: 700, letterSpacing: 0.5, transition: "background .3s",
          }}
        >
          {saved ? "✓ SAVED" : "SAVE SETTINGS"}
        </button>
      </div>
    </div>
  );
}
