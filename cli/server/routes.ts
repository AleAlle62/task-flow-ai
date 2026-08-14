import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { RunStore } from "../run/store/store.js";
import { streamEvents } from "./event-stream.js";
import type { BrowserAsker } from "./browser-asker.js";
import { tokenMatches } from "./token.js";

export interface RouteContext {
  store: RunStore;
  asker: BrowserAsker;
  token: string;
  webRoot: string;
}

/**
 * Every request the dashboard makes. Small on purpose: the browser reads the
 * run, follows the events, fetches an artifact, and answers one question.
 */
export async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (!url.pathname.startsWith("/api/")) return serveApp(url.pathname, response, context);

  if (!authorised(request, url, context.token)) return send(response, 403, { error: "bad token" });

  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/run":
      return send(response, 200, context.store.current);

    case "GET /api/gate":
      return send(response, 200, context.asker.question ?? null);

    case "GET /api/events":
      streamEvents(path.join(context.store.dir, "events.jsonl"), response);
      return;

    case "GET /api/artifact":
      return serveArtifact(url.searchParams.get("name"), response, context);

    case "POST /api/gate":
      return answerGate(request, response, context);

    default:
      return send(response, 404, { error: "no such endpoint" });
  }
}

/**
 * The token proves the request comes from the page this run opened. The Host
 * check refuses a name that merely resolves to 127.0.0.1, which is how a remote
 * site would otherwise reach a local server.
 */
function authorised(request: IncomingMessage, url: URL, token: string): boolean {
  const host = (request.headers.host ?? "").split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") return false;

  const given = url.searchParams.get("t") ?? header(request, "x-taskflow-token");

  return tokenMatches(token, given);
}

function serveArtifact(name: string | null, response: ServerResponse, context: RouteContext): void {
  if (!name || name.includes("/") || name.includes("..")) {
    return send(response, 400, { error: "bad artifact name" });
  }

  if (!context.store.hasArtifact(name)) return send(response, 404, { error: "no such artifact" });

  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end(context.store.readArtifact(name));
}

async function answerGate(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> {
  const body = await readJson(request);
  const approved = body["approved"] === true;
  const note = typeof body["note"] === "string" ? body["note"] : "";

  const accepted = context.asker.answer(approved, note);

  send(response, accepted ? 200 : 409, { accepted });
}

/** The built Vue app, or a plain message when it has not been built yet. */
function serveApp(pathname: string, response: ServerResponse, context: RouteContext): void {
  const file = path.join(context.webRoot, pathname === "/" ? "index.html" : pathname.slice(1));

  if (!file.startsWith(context.webRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const index = path.join(context.webRoot, "index.html");

    if (!fs.existsSync(index)) {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("The dashboard has not been built yet. Run: npm run build:web\n");
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fs.readFileSync(index));
    return;
  }

  response.writeHead(200, { "content-type": contentType(file) });
  response.end(fs.readFileSync(file));
}

function contentType(file: string): string {
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
  };

  return types[path.extname(file)] ?? "application/octet-stream";
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) chunks.push(chunk as Buffer);

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
