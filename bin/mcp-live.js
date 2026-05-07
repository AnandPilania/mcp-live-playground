#!/usr/bin/env node
"use strict";

import { execSync, spawn } from "child_process";
import path from "path";
import fs from "fs";
import http from "http";
import os from "os";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PKG_DIR = path.join(__dirname, "..");
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const AMBER = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(msg) { console.log(`${CYAN}[mcp-live]${RESET} ${msg}`); }
function ok(msg) { console.log(`${GREEN}[mcp-live]${RESET} ${msg}`); }
function warn(msg) { console.log(`${AMBER}[mcp-live]${RESET} ${msg}`); }

// ── Detect package manager ────────────────────────────────────────────────────
function getPm() {
    const ua = process.env.npm_config_user_agent || "";
    if (ua.startsWith("pnpm")) return "pnpm";
    if (ua.startsWith("yarn")) return "yarn";
    return "npm";
}

// ── Check if port is in use ───────────────────────────────────────────────────
function portFree(port) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => { server.close(); resolve(true); });
        server.listen(port);
    });
}

// ── Find a free port starting from `base` ─────────────────────────────────────
async function findPort(base) {
    for (let p = base; p < base + 20; p++) {
        if (await portFree(p)) return p;
    }
    return base;
}

// ── Open URL in default browser ───────────────────────────────────────────────
function openBrowser(url) {
    const cmds = { darwin: "open", win32: "start", linux: "xdg-open" };
    const cmd = cmds[process.platform] || "xdg-open";
    try {
        if (process.platform === "win32") {
            spawn("cmd", ["/c", "start", url], { detached: true, stdio: "ignore" }).unref();
        } else {
            spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
        }
    } catch { /* ignore */ }
}

// ── Install deps if needed ────────────────────────────────────────────────────
function ensureDeps() {
    const nm = path.join(PKG_DIR, "node_modules");
    if (!fs.existsSync(nm)) {
        log("Installing dependencies (first run)…");
        const pm = getPm();
        execSync(`${pm} install`, { cwd: PKG_DIR, stdio: "inherit" });
        ok("Dependencies installed.");
    }
}

// ── Check if dist/ exists, build if not ──────────────────────────────────────
function ensureBuild() {
    const dist = path.join(PKG_DIR, "dist", "index.html");
    if (!fs.existsSync(dist)) {
        log("Building production bundle (first run)…");
        const pm = getPm();
        execSync(`${pm} run build`, { cwd: PKG_DIR, stdio: "inherit" });
        ok("Build complete.");
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2);
    const mode = args.includes("--dev") ? "dev" : "serve";
    const reqPort = parseInt(args.find(a => a.startsWith("--port="))?.split("=")[1] || "0", 10);
    const noOpen = args.includes("--no-open");

    console.log(`\n${BOLD}${CYAN}  ⬡ MCP Live Playground${RESET}\n`);

    ensureDeps();

    if (mode === "dev") {
        // Dev mode: vite dev server with HMR
        const port = reqPort || await findPort(3000);
        const url = `http://localhost:${port}`;
        log(`Starting dev server at ${BOLD}${url}${RESET}`);
        if (!noOpen) setTimeout(() => openBrowser(url), 1500);

        const pm = getPm();
        const cmd = pm === "npm" ? "npx" : pm;
        const child = spawn(cmd, ["vite", "--port", String(port)], {
            cwd: PKG_DIR, stdio: "inherit", shell: process.platform === "win32",
        });
        child.on("exit", (code) => process.exit(code ?? 0));
    } else {
        // Production mode: vite preview from dist/
        ensureBuild();
        const port = reqPort || await findPort(4173);
        const url = `http://localhost:${port}`;
        log(`Serving production build at ${BOLD}${url}${RESET}`);
        if (!noOpen) setTimeout(() => openBrowser(url), 800);

        const pm = getPm();
        const cmd = pm === "npm" ? "npx" : pm;
        const child = spawn(cmd, ["vite", "preview", "--port", String(port)], {
            cwd: PKG_DIR, stdio: "inherit", shell: process.platform === "win32",
        });
        child.on("exit", (code) => process.exit(code ?? 0));
    }
}

// ── Help ──────────────────────────────────────────────────────────────────────
if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`
${BOLD}${CYAN}MCP Live Playground${RESET}

${BOLD}Usage:${RESET}
  npx mcp-live-playground          ${DIM}# serve production build${RESET}
  npx mcp-live-playground --dev    ${DIM}# start dev server with HMR${RESET}

${BOLD}Options:${RESET}
  --dev          Start Vite dev server (hot reload)
  --port=<n>     Use a specific port (default: auto)
  --no-open      Don't open browser automatically
  -h, --help     Show this help

${BOLD}Examples:${RESET}
  npx mcp-live-playground
  npx mcp-live-playground --dev --port=3000
  npx mcp-live-playground --no-open
`);
    process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
