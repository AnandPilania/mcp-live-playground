import type { McpParam, McpTool, McpResource, McpPrompt, ParsedServer } from "@/types";

// ── TypeScript / JavaScript parser ────────────────────────────────────────────

function parseZodSchema(schemaStr: string): McpParam[] {
    const params: McpParam[] = [];
    // Match each param: name: z.type(...).chain(...)
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

function parseTsTools(code: string): McpTool[] {
    const tools: McpTool[] = [];
    // server.tool("name", "desc", { schema }, handler)
    const re =
        /server\.tool\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`]\s*,\s*(\{(?:[^{}]|\{[^{}]*\})*\})/gms;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        tools.push({
            id: `${m[1]}_${tools.length}`,
            name: m[1],
            description: m[2],
            params: parseZodSchema(m[3]),
            lang: "ts",
        });
    }
    return tools;
}

// ── Python parser ─────────────────────────────────────────────────────────────

function parsePyParams(paramStr: string): McpParam[] {
    return paramStr
        .split(",")
        .map((seg): McpParam | null => {
            const name = seg.match(/^\s*(\w+)\s*:/)?.[1];
            if (!name || name === "self") return null;
            const descMatch = seg.match(/description="([^"]+)"/);
            const typeMatch = seg.match(/:\s*(\w+)/);
            const defMatch = seg.includes("default=");
            const enumMatch = seg.match(/Literal\[([^\]]+)\]/);
            return {
                name,
                type: enumMatch ? "enum" : typeMatch?.[1]?.toLowerCase() || "any",
                description: descMatch?.[1] || "",
                optional: defMatch,
                enumValues: enumMatch
                    ? enumMatch[1].replace(/["'\s]/g, "").split(",").filter(Boolean)
                    : undefined,
            };
        })
        .filter((p): p is McpParam => p !== null);
}

function parsePyTools(code: string): McpTool[] {
    const tools: McpTool[] = [];
    // @mcp.tool() or @server.tool() → async def name(params): """doc"""
    const re =
        /@(?:mcp|server)\.tool\(\)\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)[^:]*:\s*"""([\s\S]*?)"""/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        tools.push({
            id: `${m[1]}_${tools.length}`,
            name: m[1],
            description: m[3].trim(),
            params: parsePyParams(m[2]),
            lang: "py",
        });
    }
    return tools;
}

// ── Resource parser ───────────────────────────────────────────────────────────

function parseTsResources(code: string): McpResource[] {
    const resources: McpResource[] = [];
    // server.resource("name", "uri://pattern", { description, mimeType }, handler)
    const re =
        /server\.resource\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`](?:\s*,\s*\{([^}]*)\})?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        const meta = m[3] || "";
        const desc = meta.match(/description\s*:\s*["'`]([^"'`]+)["'`]/)?.[1] || "";
        const mime = meta.match(/mimeType\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
        resources.push({ name: m[1], uri: m[2], description: desc, mimeType: mime });
    }
    return resources;
}

// ── Prompt parser ─────────────────────────────────────────────────────────────

function parseTsPrompts(code: string): McpPrompt[] {
    const prompts: McpPrompt[] = [];
    // server.prompt("name", "desc", { schema }, handler)
    const re =
        /server\.prompt\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,\s*["'`]([^"'`\n]+)["'`]\s*,\s*(\{(?:[^{}]|\{[^{}]*\})*\})/gms;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
        prompts.push({
            name: m[1],
            description: m[2],
            arguments: parseZodSchema(m[3]),
        });
    }
    return prompts;
}

// ── Server metadata ───────────────────────────────────────────────────────────

function parseServerMeta(code: string): { name?: string; version?: string } {
    const nameMatch = code.match(/name\s*:\s*["'`]([^"'`]+)["'`]/);
    const versionMatch = code.match(/version\s*:\s*["'`]([^"'`]+)["'`]/);
    const pyNameMatch = code.match(/FastMCP\s*\(\s*["'`]([^"'`]+)["'`]/);
    return {
        name: nameMatch?.[1] || pyNameMatch?.[1],
        version: versionMatch?.[1],
    };
}

// ── Main parse function ───────────────────────────────────────────────────────

export function parseServer(code: string): ParsedServer {
    const isPy = /^\s*(?:from|import)\s+\w+|@\w+\.tool\(\)/m.test(code) &&
        !/^\s*(?:import|const|let|var)\s/m.test(code);

    const tools = isPy ? parsePyTools(code) : parseTsTools(code);
    const resources = isPy ? [] : parseTsResources(code);
    const prompts = isPy ? [] : parseTsPrompts(code);
    const meta = parseServerMeta(code);

    return { ...meta, tools, resources, prompts };
}

// ── JSON Schema generator ─────────────────────────────────────────────────────

export function generateJsonSchema(parsed: ParsedServer): object {
    return {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: parsed.name || "MCP Server",
        version: parsed.version || "1.0.0",
        tools: parsed.tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: {
                type: "object",
                properties: Object.fromEntries(
                    t.params.map((p) => [
                        p.name,
                        {
                            type: p.type === "enum" ? "string" : p.type,
                            description: p.description || undefined,
                            enum: p.enumValues,
                            default: p.defaultValue !== undefined ? p.defaultValue : undefined,
                            minimum: p.min !== undefined ? Number(p.min) : undefined,
                            maximum: p.max !== undefined ? Number(p.max) : undefined,
                        },
                    ])
                ),
                required: t.params.filter((p) => !p.optional).map((p) => p.name),
                additionalProperties: false,
            },
        })),
        resources: parsed.resources.map((r) => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType,
        })),
        prompts: parsed.prompts.map((p) => ({
            name: p.name,
            description: p.description,
            arguments: p.arguments,
        })),
    };
}
