export interface Template {
    name: string;
    lang: "ts" | "py";
    description: string;
    code: string;
}

export const TEMPLATES: Template[] = [
    {
        name: "Weather + Translate",
        lang: "ts",
        description: "TypeScript server with weather and translation tools",
        code: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "utility-server",
  version: "1.0.0",
});

// Fetch current weather for any city
server.tool(
  "get_weather",
  "Fetch current weather conditions and forecast for any city worldwide",
  {
    city: z.string().describe("City name, e.g. 'Tokyo' or 'New York'"),
    units: z.enum(["metric", "imperial"]).default("metric")
      .describe("Temperature unit system"),
    days: z.number().min(1).max(7).default(1)
      .describe("Number of forecast days to return"),
  },
  async ({ city, units, days }) => {
    const geoUrl = \`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(city)}&count=1\`;
    const { results: [loc] } = await fetch(geoUrl).then(r => r.json());
    if (!loc) throw new Error(\`City not found: \${city}\`);

    const unit = units === "imperial" ? "fahrenheit" : "celsius";
    const forecastUrl = [
      "https://api.open-meteo.com/v1/forecast",
      \`?latitude=\${loc.latitude}&longitude=\${loc.longitude}\`,
      \`&current=temperature_2m,weathercode,windspeed_10m\`,
      \`&daily=temperature_2m_max,temperature_2m_min,precipitation_sum\`,
      \`&forecast_days=\${days}&temperature_unit=\${unit}\`,
    ].join("");
    const data = await fetch(forecastUrl).then(r => r.json());

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          location: \`\${loc.name}, \${loc.country_code}\`,
          current: data.current,
          forecast: data.daily,
        }, null, 2),
      }],
    };
  }
);

// Translate text between languages
server.tool(
  "translate_text",
  "Translate any text between supported language pairs",
  {
    text: z.string().min(1).max(5000).describe("Text content to translate"),
    source_lang: z.string().length(2).describe("ISO 639-1 source language code, e.g. 'en'"),
    target_lang: z.string().length(2).describe("ISO 639-1 target language code, e.g. 'fr'"),
    formality: z.enum(["default", "more", "less"]).default("default")
      .describe("Desired formality level"),
  },
  async ({ text, source_lang, target_lang }) => {
    // Connect to your preferred translation API here
    return {
      content: [{
        type: "text",
        text: \`[\${source_lang} → \${target_lang}] \${text}\`,
      }],
    };
  }
);

server.listen();
`,
    },
    {
        name: "Database Tools",
        lang: "ts",
        description: "TypeScript server for safe database introspection and querying",
        code: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Pool } from "pg";

const server = new McpServer({ name: "db-server", version: "1.0.0" });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Execute read-only SQL queries safely
server.tool(
  "query_database",
  "Execute a read-only SELECT query and return results as structured JSON",
  {
    sql: z.string().describe("Valid SQL SELECT statement"),
    database: z.string().describe("Target database or schema name"),
    limit: z.number().int().min(1).max(1000).default(100)
      .describe("Maximum rows to return"),
    timeout_ms: z.number().int().min(100).max(30000).default(5000)
      .describe("Query timeout in milliseconds"),
  },
  async ({ sql, database, limit, timeout_ms }) => {
    if (!/^\\s*SELECT/i.test(sql))
      throw new Error("Only SELECT queries are allowed for safety");

    const client = await pool.connect();
    try {
      await client.query(\`SET search_path TO \${database}\`);
      await client.query(\`SET statement_timeout = \${timeout_ms}\`);
      const result = await client.query(\`\${sql} LIMIT \${limit}\`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ rowCount: result.rowCount, rows: result.rows }, null, 2),
        }],
      };
    } finally {
      client.release();
    }
  }
);

// List tables with optional column metadata
server.tool(
  "list_tables",
  "List all tables in a database schema with optional column details",
  {
    database: z.string().describe("Database or schema name"),
    include_columns: z.boolean().default(true).describe("Include column info"),
    table_pattern: z.string().optional().describe("LIKE pattern, e.g. 'user%'"),
  },
  async ({ database, table_pattern }) => {
    const client = await pool.connect();
    try {
      const where = table_pattern
        ? \`AND table_name LIKE '\${table_pattern}'\`
        : "";
      const { rows } = await client.query(
        \`SELECT table_name, table_type
         FROM information_schema.tables
         WHERE table_schema = '\${database}' \${where}
         ORDER BY table_name\`
      );
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    } finally {
      client.release();
    }
  }
);

server.listen();
`,
    },
    {
        name: "File System",
        lang: "ts",
        description: "Safe sandboxed file system operations",
        code: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

const server = new McpServer({ name: "fs-server", version: "1.0.0" });
const WORKSPACE_ROOT = process.env.FS_ROOT || process.cwd();

function resolveSafe(p: string): string {
  const abs = path.resolve(WORKSPACE_ROOT, p);
  if (!abs.startsWith(WORKSPACE_ROOT))
    throw new Error("Path traversal attempt blocked");
  return abs;
}

// Read file with size guard
server.tool(
  "read_file",
  "Read and return the text contents of a file within the workspace",
  {
    file_path: z.string().describe("Relative path from workspace root"),
    encoding: z.enum(["utf-8", "base64"]).default("utf-8")
      .describe("Read encoding"),
    max_bytes: z.number().int().min(1).max(10_000_000).default(500_000)
      .describe("Max bytes to read before truncating"),
  },
  async ({ file_path, max_bytes }) => {
    const abs  = resolveSafe(file_path);
    const stat = await fs.stat(abs);
    if (stat.size > max_bytes)
      throw new Error(\`File is \${stat.size} bytes, exceeds max_bytes \${max_bytes}\`);
    return { content: [{ type: "text", text: await fs.readFile(abs, "utf-8") }] };
  }
);

// Write / create file
server.tool(
  "write_file",
  "Create or overwrite a file with provided text content",
  {
    file_path: z.string().describe("Destination path relative to workspace root"),
    content: z.string().describe("Text content to write"),
    create_dirs: z.boolean().default(true).describe("Auto-create parent directories"),
  },
  async ({ file_path, content, create_dirs }) => {
    const abs = resolveSafe(file_path);
    if (create_dirs) await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
    return { content: [{ type: "text", text: \`Written \${content.length} chars to \${file_path}\` }] };
  }
);

// List directory
server.tool(
  "list_directory",
  "List files and subdirectories at a given path",
  {
    dir_path: z.string().describe("Directory path relative to workspace root"),
    show_hidden: z.boolean().default(false).describe("Include dotfiles"),
    filter_ext: z.string().optional().describe("Extension filter, e.g. '.ts'"),
  },
  async ({ dir_path, show_hidden, filter_ext }) => {
    const abs = resolveSafe(dir_path);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const items = entries
      .filter(e => show_hidden || !e.name.startsWith("."))
      .filter(e => !filter_ext || e.name.endsWith(filter_ext))
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
        path: path.join(dir_path, e.name),
      }));
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  }
);

server.listen();
`,
    },
    {
        name: "Python (FastMCP)",
        lang: "py",
        description: "Python FastMCP server with web search, sentiment, and image generation",
        code: `from mcp import FastMCP
from pydantic import Field
from typing import Optional, Literal
import httpx

mcp = FastMCP("python-server", version="1.0.0")


@mcp.tool()
async def search_web(
    query: str = Field(description="Search query string"),
    num_results: int = Field(default=10, ge=1, le=50, description="Results to return"),
    safe_search: bool = Field(default=True, description="Enable safe search filter"),
) -> dict:
    """Search the web and return a list of relevant results with titles and snippets."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.search.example.com/v1/search",
            params={"q": query, "num": num_results, "safe": safe_search},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def analyze_sentiment(
    text: str = Field(description="Text content to analyze (max 10,000 chars)"),
    model: Literal["fast", "balanced", "accurate"] = Field(
        default="balanced",
        description="Analysis model — trade off between speed and accuracy",
    ),
    include_entities: bool = Field(
        default=False,
        description="Also extract named entities (persons, orgs, locations)",
    ),
) -> dict:
    """Analyze sentiment, tone, and optionally named entities in a text."""
    # Connect your sentiment analysis API or model here
    return {
        "sentiment": "positive",
        "confidence": 0.87,
        "tone": ["professional", "enthusiastic"],
        "entities": (
            [{"text": "example", "type": "ORG", "score": 0.95}]
            if include_entities
            else []
        ),
    }


@mcp.tool()
async def generate_image(
    prompt: str = Field(description="Descriptive prompt for the image"),
    width: int = Field(default=1024, ge=256, le=2048, description="Width in pixels"),
    height: int = Field(default=1024, ge=256, le=2048, description="Height in pixels"),
    style: Literal["photorealistic", "illustration", "sketch", "3d-render"] = Field(
        default="photorealistic",
        description="Visual style of the generated image",
    ),
    seed: Optional[int] = Field(default=None, description="Seed for reproducibility"),
) -> dict:
    """Generate an image from a text prompt using a diffusion model."""
    # Connect your image generation API here
    return {
        "url": "https://cdn.example.com/images/generated-abc123.png",
        "width": width,
        "height": height,
        "prompt": prompt,
        "seed": seed,
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
`,
    },
    {
        name: "Empty Server",
        lang: "ts",
        description: "Blank TypeScript MCP server to start from scratch",
        code: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0",
});

// Add your first tool here
server.tool(
  "hello_world",
  "A simple hello world tool to get started",
  {
    name: z.string().describe("Name to greet"),
  },
  async ({ name }) => {
    return {
      content: [{ type: "text", text: \`Hello, \${name}! 👋\` }],
    };
  }
);

server.listen();
`,
    },
];

export const DEFAULT_TEMPLATE = TEMPLATES[0];
