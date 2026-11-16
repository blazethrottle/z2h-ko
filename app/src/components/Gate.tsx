// 화면 부품(island)이 켜지기(마운트) 전에 누른 클릭은 버려진다(느린 폰에서 "눌렀는데 반응 없음").
// 그래서 모든 부품을 같은 방식 하나로 감싼다: 겉을 <fieldset disabled aria-busy="true"> 로 그려
// 정적 HTML 에서는 안의 버튼·입력칸이 모두 눌리지 않는 상태(disabled)로 보이고, 마운트되면 풀린다.
// 링크(a)는 자바스크립트 없이도 이동하므로 막지 않는다. 크기(44px)와 색은 그대로(.btn:disabled 토큰 색).
import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';

export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** 부품을 마운트 전 잠금으로 감싼다. Astro 페이지는 이 함수가 돌려준 부품을 client:load 로 쓴다 */
export function gated<P extends object>(Inner: ComponentType<P>, name: string) {
  function Gated(p: P) {
    const m = useMounted();
    return (
      <fieldset class="gate" disabled={!m} aria-busy={m ? undefined : 'true'} data-gate={name} data-mounted={m ? 'true' : 'false'}>
        <Inner {...p} />
      </fieldset>
    );
  }
  Gated.displayName = `Gated(${name})`;
  return Gated;
}
