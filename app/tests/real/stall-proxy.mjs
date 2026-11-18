// 실서버 멈춤 검사(sync-stall.spec.ts)의 중계기: 진도 서버 앞에 두고 127.0.0.1 에만 붙는다.
// 평소에는 그대로 넘기고, holdSync 를 켜면 POST /api/sync 를 서버까지 보낸 뒤 응답 머리(상태·머리말)만 돌려주고 본문은 보내지도 닫지도 않는다
// (2026-11-18 운영 사고와 같은 모양: 서버는 받아 처리했지만 앱은 본문을 기다린다).
import http from 'node:http';
import { LOCAL_HOST } from '../../src/lib/api-target.mjs';

/**
 * @param {{ port: number, target: string }} o
 */
export async function startProxy({ port, target }) {
  const t = new URL(target);
  /** @type {{ t: number, method: string, path: string, status: number | null, held: boolean }[]} */
  const log = [];
  const sockets = new Set();
  let holdSync = false;
  const server = http.createServer((req, res) => {
    const path = req.url ?? '/';
    const entry = { t: Date.now(), method: req.method ?? 'GET', path, status: /** @type {number | null} */ (null), held: false };
    log.push(entry);
    const up = http.request({ host: t.hostname, port: t.port, method: req.method, path, headers: req.headers }, (upRes) => {
      entry.status = upRes.statusCode ?? null;
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      if (holdSync && req.method === 'POST' && path.startsWith('/api/sync')) {
        entry.held = true;
        res.flushHeaders();
        upRes.resume();
        return;
      }
      upRes.pipe(res);
    });
    up.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, LOCAL_HOST, () => resolve(undefined));
  });
  return {
    base: `http://${LOCAL_HOST}:${port}`,
    log,
    /** @param {boolean} v */
    setHoldSync(v) {
      holdSync = v;
    },
    close: () =>
      new Promise((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve(undefined));
      }),
  };
}
