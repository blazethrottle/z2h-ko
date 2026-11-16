// Z2H 앱 설정. 정적 빌드(app/dist). dev 서버는 127.0.0.1에만 붙고 /api 는 진도 서버(127.0.0.1:8787)로 넘긴다.
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { API_TARGET } from './src/lib/api-target.mjs';

export default defineConfig({
  output: 'static',
  // ignore: 정적 출력은 디렉터리 형식(/home/ → home/index.html) 그대로. 'always'면 dev에서 /api 요청이 프록시 전에 404가 된다
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  server: { host: '127.0.0.1', port: 4321 },
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
              // 진도 서버는 쓰기 요청의 Origin을 확인한다. dev 주소(4321) 대신 서버 주소로 바꿔 보낸다
              if (proxyReq.getHeader('origin')) proxyReq.setHeader('origin', API_TARGET);
              for (const h of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-real-ip', 'forwarded', 'cf-connecting-ip', 'cf-ray'])
                proxyReq.removeHeader(h);
            });
          },
        },
      },
    },
    preview: { host: '127.0.0.1' },
  },
});
