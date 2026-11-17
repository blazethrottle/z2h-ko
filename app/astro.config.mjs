// Z2H 앱 설정. 정적 빌드(app/dist). dev 서버는 127.0.0.1에만 붙고 /api 는 진도 서버(127.0.0.1:8787)로 넘긴다.
// Z2H_API_PROXY=off 이면 preview 의 /api 프록시를 끈다(자동 브라우저 검사용: 켜 둔 진도 서버에 닿지 않게).
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { API_TARGET, DEV_PORT, proxiedOrigin } from './src/lib/api-target.mjs';

const previewProxyOff = process.env.Z2H_API_PROXY === 'off';

export default defineConfig({
  output: 'static',
  // ignore: 정적 출력은 디렉터리 형식(/home/ → home/index.html) 그대로. 'always'면 dev에서 /api 요청이 프록시 전에 404가 된다
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  server: { host: '127.0.0.1', port: DEV_PORT },
  devToolbar: { enabled: false },
  integrations: [preact()],
  vite: {
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
          // 서버는 프록시·터널 전달 머리말이 있으면 개발용 로그인을 거부한다(server/API.md 1절). 붙이지 않는다
          xfwd: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // 진도 서버는 쓰기 요청의 Origin을 확인한다. dev 서버 자기 주소(4321)에서 온 것만 서버 주소로 바꿔 보낸다.
              // 다른 사이트의 Origin 은 그대로 넘겨 서버가 거부하게 둔다
              const origin = proxyReq.getHeader('origin');
              const next = proxiedOrigin(origin);
              if (origin != null && next !== origin) proxyReq.setHeader('origin', next);
              for (const h of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'cf-ray'])
                proxyReq.removeHeader(h);
            });
          },
        },
      },
    },
    // preview 는 따로 정하지 않으면 위 server.proxy 를 그대로 쓴다. 끌 때는 빈 프록시로 덮는다
    preview: previewProxyOff ? { host: '127.0.0.1', proxy: {} } : { host: '127.0.0.1' },
  },
});
