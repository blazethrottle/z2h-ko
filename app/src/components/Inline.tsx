// 콘텐츠 글 안의 `백틱` 구간을 인라인 코드(JetBrains Mono)로 그린다. 줄바꿈(\n)은 줄바꿈으로 살린다("- " 목록 줄도 글 그대로).
// bold 를 켜면 **굵게** 도 그린다(기본은 끔: 정본 글의 ** 는 대개 거듭제곱 기호). 그 밖의 마크다운은 쓰지 않는다.
import { inlineParts } from '../lib/inline';

export default function Inline({ text, bold = false }: { text: string | null | undefined; bold?: boolean }) {
  return (
    <>
      {inlineParts(text, { bold }).map((p) =>
        p.kind === 'br' ? <br /> : p.kind === 'code' ? <code class="inline">{p.value}</code> : p.kind === 'strong' ? <b>{p.value}</b> : p.value,
      )}
    </>
  );
}
