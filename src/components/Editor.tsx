import { useEffect, useRef, useCallback } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: "ts" | "py";
}

const customTheme = EditorView.theme({
  "&": {
    background: "var(--bg1)",
    color: "var(--txt)",
    height: "100%",
  },
  ".cm-content": { padding: "12px 0", caretColor: "var(--cyan)" },
  ".cm-focused": { outline: "none" },
  ".cm-editor": { height: "100%" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.65" },
  ".cm-gutters": {
    background: "var(--bg1)",
    color: "var(--txt3)",
    border: "none",
    borderRight: "1px solid var(--border)",
    paddingRight: "4px",
  },
  ".cm-lineNumbers .cm-gutterElement": { minWidth: "36px", textAlign: "right" },
  ".cm-activeLine":      { background: "rgba(0,216,255,0.04)" },
  ".cm-activeLineGutter":{ background: "rgba(0,216,255,0.06)" },
  ".cm-cursor":          { borderLeftColor: "var(--cyan)" },
  ".cm-selectionBackground, ::selection": { background: "rgba(0,216,255,0.18) !important" },
  ".cm-matchingBracket": { background: "rgba(0,216,255,0.2)", outline: "1px solid var(--cyan2)" },
  ".cm-tooltip":         { background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: "4px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { background: "var(--cyan-dim)" },
});

export default function Editor({ value, onChange, language = "ts" }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef      = useRef<EditorView | null>(null);
  const onChangeRef  = useRef(onChange);
  onChangeRef.current = onChange;

  const init = useCallback(() => {
    if (!containerRef.current) return;
    viewRef.current?.destroy();

    const lang = language === "py" ? python() : javascript({ typescript: true });
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([...defaultKeymap, indentWithTab]),
        lang,
        oneDark,
        customTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });
    viewRef.current = new EditorView({ state, parent: containerRef.current });
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-init when language changes
  useEffect(() => { init(); return () => viewRef.current?.destroy(); }, [init]);

  // Sync external value changes (template load etc.) without reinitializing
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: "hidden", height: "100%" }}
    />
  );
}
