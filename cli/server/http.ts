import { createServer, type Server } from "node:http";
import path from "node:path";

import { packageRoot } from "../paths.js";
import type { RunStore } from "../run/store/store.js";
import { BrowserAsker } from "./browser-asker.js";
import { handle } from "./routes.js";
import { newToken } from "./token.js";

/** Where `vite build` leaves the dashboard. */
const WEB_ROOT = path.join(packageRoot, "web-dist");

export interface Dashboard {
  /** The address to open, token included. */
  url: string;
  /** The thing a waiting run asks its questions through. */
  asker: BrowserAsker;
  close: () => Promise<void>;
}

/**
 * Starts the dashboard for one run.
 *
 * Bound to the loopback address only: this server can approve a plan that then
 * writes to your code, so it is never reachable from another machine, and every
 * request has to carry the token minted here.
 */
export function startDashboard(store: RunStore, port: number): Promise<Dashboard> {
  const token = newToken();

  return new Promise<Dashboard>((resolve, reject) => {
    let asker: BrowserAsker | undefined;

    const server = createServer((request, response) => {
      handle(request, response, {
        store,
        asker: asker as BrowserAsker,
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
      asker = new BrowserAsker(url);

      resolve({ url, asker, close: () => closeServer(server) });
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
