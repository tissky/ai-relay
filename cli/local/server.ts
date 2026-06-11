// ============================================================
// AI Relay CLI — Local HTTP Server
// ============================================================

import * as http from 'http';
import type { LocalProfile } from './profile';

export interface LocalServer {
  port: number;
  stop(): Promise<void>;
}

export async function startLocalServer(profile: LocalProfile): Promise<LocalServer> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '2.13.0' }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    server.listen(profile.listenPort, profile.listenHost, () => {
      resolve({
        port: profile.listenPort,
        async stop() {
          return new Promise((resolve) => server.close(() => resolve()));
        },
      });
    });
  });
}
