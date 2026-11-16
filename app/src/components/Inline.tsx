// 콘텐츠 글 안의 `백틱` 구간을 인라인 코드(JetBrains Mono)로 그린다. 그 밖의 마크다운은 쓰지 않는다.
export default function Inline({ text }: { text: string | null | undefined }) {
  const parts = String(text ?? '').split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p) =>
        p.length > 2 && p.startsWith('`') && p.endsWith('`') ? <code class="inline">{p.slice(1, -1)}</code> : p,
      )}
    </>
  );
}
