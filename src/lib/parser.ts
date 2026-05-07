import type { McpParam, McpTool, McpResource, McpPrompt, ParsedServer } from "@/types";

// ── Utility: split args respecting nested parens/brackets ────────────────────
function splitArgs(s: string): string[] {
    const parts: string[] = [];
    let depth = 0, cur = "";
    for (const ch of s) {
        if (ch === "(" || ch === "[" || ch === "{") { depth++; cur += ch; }
        else if (ch === ")" || ch === "]" || ch === "}") { depth--; cur += ch; }
        else if (ch === "," && depth === 0) { parts.push(cur); cur = ""; }
        else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
}

// ── Utility: extract balanced block starting at `pos` ────────────────────────
function extractBlock(code: string, pos: number, open: string, close: string): string {
    let depth = 0, i = pos, started = false;
    while (i < code.length) {
        if (code[i] === open) { depth++; started = true; }
        if (code[i] === close) { depth--; }
        if (started && depth === 0) return code.slice(pos, i + 1);
        i++;
    }
    return code.slice(pos);
}

// ── TypeScript Zod schema parser ──────────────────────────────────────────────
function parseZodSchema(schemaStr: string): McpParam[] {
    const params: McpParam[] = [];
    const re = /(\w+)\s*:\s*z\.(\w+)\s*\(([^)]*)\)((?:\.[a-zA-Z]+\([^)]*\))*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(schemaStr)) !== null) {
        const chain = m[0];
        const enumMatch = chain.match(/z\.enum\s*\(\s*\[([^\]]+)\]/);
        const descMatch = chain.match(/\.describe\s*\(["'`]([^"'`]+)["'`]\)/);
        const defMatch = chain.match(/\.default\s*\(([^)]+)\)/);
        const minMatch = chain.match(/\.min\s*\((\d+)\)/);
        const maxMatch = chain.match(/\.max\s*\((\d+)\)/);
        params.push({
            name: m[1],
            type: enumMatch ? "enum" : m[2],
            description: descMatch?.[1] || "",
            optional: !!defMatch,
            enumValues: enumMatch
                ? enumMatch[1].replace(/["'\s]/g, "").split(",").filter(Boolean)
                : undefined,
            defaultValue: defMatch?.[1],
            min: minMatch?.[1],
            max: maxMatch?.[1],
        });
    }
    return params;
}

// ── TypeScript tools ──────────────────────────────────────────────────────────
function parseTsTools(code: string): McpTool[] {
    const tools: McpTool[] = [];
    const re = /server\.tool\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`]\s*,\s*(\{)/gms;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        const schemaStart = m.index + m[0].length - 1;
        const schemaBlock = extractBlock(code, schemaStart, "{", "}");
        tools.push({
            id: `${m[1]}_${tools.length}`,
            name: m[1],
            description: m[2],
            params: parseZodSchema(schemaBlock),
            lang: "ts",
        });
    }
    return tools;
}

// ── Python FastMCP param parser ───────────────────────────────────────────────
function parsePyParam(seg: string): McpParam | null {
    seg = seg.trim();
    if (!seg) return null;

    const nameMatch = seg.match(/^(\w+)\s*:/);
    if (!nameMatch) return null;
    const name = nameMatch[1];
    if (name === "self" || name === "cls" || name === "return") return null;

    const afterColon = seg.slice(nameMatch[0].length).trim();
    const eqIdx = afterColon.search(/(?<!\w)=(?!=)/);
    const typeStr = (eqIdx >= 0 ? afterColon.slice(0, eqIdx) : afterColon).trim();

    const literalMatch = typeStr.match(/Literal\s*\[([^\]]+)\]/);
    const isOptional = typeStr.includes("Optional") || afterColon.match(/=\s*None\b/) !== null;

    let type = "any";
    if (literalMatch) {
        type = "enum";
    } else {
        const base = typeStr
            .replace(/Optional\s*\[([^\]]+)\]/, "$1")
            .replace(/\s*\|.*/, "") // strip union types
            .trim();
        const norm: Record<string, string> = {
            str: "string", int: "number", float: "number", bool: "boolean",
            dict: "object", list: "array", tuple: "array",
        };
        type = norm[base.toLowerCase()] || base.toLowerCase() || "any";
    }

    // Extract Field(...) block if present
    const fieldIdx = afterColon.search(/Field\s*\(/);
    let fieldStr = "";
    if (fieldIdx >= 0) {
        const fieldBlock = extractBlock(afterColon, fieldIdx + afterColon.slice(fieldIdx).indexOf("("), "(", ")");
        fieldStr = fieldBlock.slice(1, -1); // strip outer parens
    }

    // Split fieldStr args carefully
    const fieldArgs = splitArgs(fieldStr);
    const getField = (key: string) =>
        fieldArgs.find((a) => a.trim().startsWith(key + "="))
            ?.replace(new RegExp(`^\\s*${key}\\s*=\\s*`), "")
            .trim();

    const description = getField("description")?.replace(/^["']|["']$/g, "") || "";
    const defaultVal = getField("default");
    const ge = getField("ge"); const gt = getField("gt");
    const le = getField("le"); const lt = getField("lt");

    return {
        name,
        type,
        description,
        optional: isOptional || defaultVal !== undefined,
        enumValues: literalMatch
            ? literalMatch[1].replace(/["'\s]/g, "").split(",").filter(Boolean)
            : undefined,
        defaultValue: defaultVal,
        min: ge ?? gt,
        max: le ?? lt,
    };
}

// ── Python FastMCP tool extractor ─────────────────────────────────────────────
function parsePyTools(code: string): McpTool[] {
    const tools: McpTool[] = [];

    // Match @mcp.tool() or @server.tool() decorator + function header
    const decoratorRe = /@(?:mcp|server)\.tool\s*\([^)]*\)\s*(?:async\s+)?def\s+(\w+)\s*\(/g;
    let m: RegExpExecArray | null;

    while ((m = decoratorRe.exec(code)) !== null) {
        const funcName = m[1];
        const parenStart = m.index + m[0].length - 1;
        const paramBlock = extractBlock(code, parenStart, "(", ")");
        const paramInner = paramBlock.slice(1, -1);

        // Find docstring after the closing paren of params (skip -> rettype :)
        const afterParams = code.slice(parenStart + paramBlock.length);
        const docMatch = afterParams.match(/^\s*(?:->\s*[\w\[\], |]+)?\s*:\s*\n\s*"""([\s\S]*?)"""/);
        const description = docMatch?.[1]?.trim() || "";

        const rawParams = splitArgs(paramInner);
        const params = rawParams
            .map(parsePyParam)
            .filter((p): p is McpParam => p !== null);

        tools.push({ id: `${funcName}_${tools.length}`, name: funcName, description, params, lang: "py" });
    }
    return tools;
}

// ── Resource / Prompt parsers (TS only) ───────────────────────────────────────
function parseTsResources(code: string): McpResource[] {
    const resources: McpResource[] = [];
    const re = /server\.resource\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`](?:\s*,\s*\{([^}]*)\})?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        const meta = m[3] || "";
        resources.push({
            name: m[1], uri: m[2],
            description: meta.match(/description\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] || "",
            mimeType: meta.match(/mimeType\s*:\s*["'`]([^"'`]+)["'`]/)?.[1],
        });
    }
    return resources;
}

function parseTsPrompts(code: string): McpPrompt[] {
    const prompts: McpPrompt[] = [];
    const re = /server\.prompt\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`]\s*,\s*(\{)/gms;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        const schemaStart = m.index + m[0].length - 1;
        const schemaBlock = extractBlock(code, schemaStart, "{", "}");
        prompts.push({ name: m[1], description: m[2], arguments: parseZodSchema(schemaBlock) });
    }
    return prompts;
}

// ── Language detection ────────────────────────────────────────────────────────
export function detectLanguage(code: string): "ts" | "py" {
    const pyScore =
        (code.match(/@\w+\.tool\s*\(\)/g)?.length || 0) * 4 +
        (code.match(/\bdef\s+\w+\s*\(/g)?.length || 0) * 2 +
        (code.match(/from\s+\w+\s+import/g)?.length || 0) * 2 +
        (code.match(/:\s*str\b|:\s*int\b|:\s*bool\b/g)?.length || 0);
    const tsScore =
        (code.match(/server\.tool\s*\(/g)?.length || 0) * 4 +
        (code.match(/\bconst\b|\blet\b|\bvar\b/g)?.length || 0) +
        (code.match(/=>\s*\{/g)?.length || 0) * 2 +
        (code.match(/\bz\.\w+\s*\(/g)?.length || 0) * 2;
    return pyScore > tsScore ? "py" : "ts";
}

// ── Server metadata ───────────────────────────────────────────────────────────
function parseServerMeta(code: string): { name?: string; version?: string } {
    return {
        name: code.match(/name\s*:\s*["'`]([^"'`]+)["'`]/)?.[1]
            || code.match(/FastMCP\s*\(\s*["'`]([^"'`]+)["'`]/)?.[1],
        version: code.match(/version\s*[:=]\s*["'`]([^"'`]+)["'`]/)?.[1],
    };
}

// ── Main parse function ───────────────────────────────────────────────────────
export function parseServer(code: string): ParsedServer {
    const lang = detectLanguage(code);
    return {
        ...parseServerMeta(code),
        tools: lang === "py" ? parsePyTools(code) : parseTsTools(code),
        resources: lang === "py" ? [] : parseTsResources(code),
        prompts: lang === "py" ? [] : parseTsPrompts(code),
    };
}

// ── JSON Schema generator ─────────────────────────────────────────────────────
export function generateJsonSchema(parsed: ParsedServer): object {
    return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: parsed.name || "MCP Server",
        version: parsed.version || "1.0.0",
        tools: parsed.tools.map((t) => ({
            name: t.name, description: t.description,
            inputSchema: {
                type: "object",
                properties: Object.fromEntries(t.params.map((p) => [p.name, {
                    type: p.type === "enum" ? "string" : p.type,
                    description: p.description || undefined,
                    enum: p.enumValues,
                    default: p.defaultValue !== undefined ? p.defaultValue : undefined,
                    minimum: p.min !== undefined ? Number(p.min) : undefined,
                    maximum: p.max !== undefined ? Number(p.max) : undefined,
                }])),
                required: t.params.filter((p) => !p.optional).map((p) => p.name),
                additionalProperties: false,
            },
        })),
        resources: parsed.resources,
        prompts: parsed.prompts,
    };
}
