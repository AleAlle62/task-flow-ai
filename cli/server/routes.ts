import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { streamEvents } from "./event-stream.js";
import type { Session } from "./session.js";
import { tokenMatches } from "./token.js";

export interface RouteContext {
  session: Session;
  token: string;
  webRoot: string;
  /** The addresses this dashboard is served from, for the Origin check. */
  origins: string[];
}

/**
 * A request body is a task or a note a person typed, so a megabyte is already
 * far more than generous. Without a limit the whole thing is read into memory
 * before anything looks at it.
 */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Every request the dashboard makes. Small on purpose: the page says what to
 * do, then reads the run, follows the events, opens an artifact, and answers
 * one question at a time.
 */
export async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  if (!url.pathname.startsWith("/api/")) return serveApp(url.pathname, response, context);

  if (!sameOrigin(request, context.origins)) return send(response, 403, { error: "bad origin" });

  if (!authorised(request, url, context.token)) return send(response, 403, { error: "bad token" });

  const { session } = context;

  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/run":
      return send(response, 200, session.store?.current ?? null);

    case "GET /api/plan":
      return send(response, 200, { phases: session.plan });

    case "GET /api/task":
      return send(response, 200, { waiting: session.prompter.awaitingTask });

    case "POST /api/task":
      return submitTask(request, response, context);

    case "GET /api/gate":
      return send(response, 200, session.prompter.question ?? null);

    case "POST /api/gate":
      return answerGate(request, response, context);

    case "GET /api/events":
      if (!session.store) return send(response, 409, { error: "no run yet" });
      streamEvents(path.join(session.store.dir, "events.jsonl"), response);
      return;

    case "GET /api/artifact":
      return serveArtifact(url.searchParams.get("name"), response, context);

    default:
      return send(response, 404, { error: "no such endpoint" });
  }
}

/**
 * The token proves the request comes from the page this run opened. The Host
 * check refuses a name that merely resolves to 127.0.0.1, which is how a remote
 * site would otherwise reach a local server.
 */
/**
 * Refuses a request another site told your browser to make.
 *
 * The token is the real lock, but it is carried in the address of the page,
 * which is the kind of thing that ends up in a screenshot or a pasted bug
 * report. This is the second lock: a page on another origin cannot forge an
 * `Origin` header, so a request that names one that is not ours is refused
 * before the token is even looked at.
 *
 * A missing `Origin` is allowed. Plain navigations and same-origin GETs do not
 * send one, and neither does `curl` — which is a perfectly ordinary way to
 * poke at your own run.
 */
function sameOrigin(request: IncomingMessage, origins: string[]): boolean {
  const origin = header(request, "origin");

  return origin === undefined || origins.includes(origin);
}

function authorised(request: IncomingMessage, url: URL, token: string): boolean {
  const host = (request.headers.host ?? "").split(":")[0];
  if (host !== "127.0.0.1" && host !== "localhost") return false;

  const given = url.searchParams.get("t") ?? header(request, "x-taskflow-token");

  return tokenMatches(token, given);
}

async function submitTask(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> {
  const body = await readJson(request);

  if (!body) return refuseBody(request, response);

  const task = typeof body["task"] === "string" ? body["task"] : "";

  send(response, 200, { accepted: context.session.prompter.provideTask(task) });
}

async function answerGate(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
): Promise<void> {
  const body = await readJson(request);

  if (!body) return refuseBody(request, response);

  const phase = typeof body["phase"] === "string" ? body["phase"] : "";
  const approved = body["approved"] === true;
  const note = typeof body["note"] === "string" ? body["note"] : "";

  const accepted = context.session.prompter.answer(phase, approved, note);

  send(response, accepted ? 200 : 409, { accepted });
}

function serveArtifact(name: string | null, response: ServerResponse, context: RouteContext): void {
  const store = context.session.store;

  if (!name || name.includes("/") || name.includes("..")) {
    return send(response, 400, { error: "bad artifact name" });
  }

  if (!store?.hasArtifact(name)) return send(response, 404, { error: "no such artifact" });

  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end(store.readArtifact(name));
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

/**
 * Says no to an oversized body and then hangs up.
 *
 * The answer goes out first and the connection is closed after, so the client
 * is told what happened rather than left guessing at a dropped socket. The
 * close is what stops the rest of the upload arriving on a connection nobody
 * is reading any more.
 */
function refuseBody(request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(413, {
    "content-type": "application/json; charset=utf-8",
    connection: "close",
  });

  response.end(`{"error":"body too large"}`, () => request.destroy());
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
}

/** Undefined when the body is bigger than anything a person could have typed. */
async function readJson(request: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    size += (chunk as Buffer).length;

    /* Stop reading, but leave the socket alone: the caller still has to answer
     * on it, and destroying here means the client sees a dropped connection
     * instead of being told what was wrong. */
    if (size > MAX_BODY_BYTES) return undefined;

    chunks.push(chunk as Buffer);
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
