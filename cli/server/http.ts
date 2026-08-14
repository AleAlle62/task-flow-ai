import { createServer, type Server } from "node:http";
import path from "node:path";

import { packageRoot } from "../paths.js";
import { BrowserPrompter } from "./browser-prompter.js";
import { handle } from "./routes.js";
import { Session } from "./session.js";
import { newToken } from "./token.js";

/** Where `vite build` leaves the dashboard. */
const WEB_ROOT = path.join(packageRoot, "web-dist");

export interface Dashboard {
  /** The address to open, token included. */
  url: string;
  /** What the page is asked, and where its answers arrive. */
  prompter: BrowserPrompter;
  /** Hands the run to the page, once there is one. */
  session: Session;
  close: () => Promise<void>;
}

/**
 * Starts the dashboard.
 *
 * It comes up before there is a run, because the first thing it asks is what
 * the run should be about. Bound to the loopback address only: this server can
 * approve a plan that then writes to your code, so it is never reachable from
 * another machine, and every request has to carry the token minted here.
 */
export function startDashboard(port: number): Promise<Dashboard> {
  const token = newToken();

  return new Promise<Dashboard>((resolve, reject) => {
    let session: Session | undefined;

    const server = createServer((request, response) => {
      handle(request, response, {
        session: session as Session,
        token,
        webRoot: WEB_ROOT,
      }).catch(() => {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(`{"error":"internal"}`);
      });
    });

    server.once("error", reject);

    server.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${actualPort(server, port)}/?t=${token}`;
      const prompter = new BrowserPrompter(url);

      session = new Session(prompter);

      resolve({ url, prompter, session, close: () => closeServer(server) });
    });
  });
}

function actualPort(server: Server, requested: number): number {
  const address = server.address();

  return typeof address === "object" && address !== null ? address.port : requested;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}
