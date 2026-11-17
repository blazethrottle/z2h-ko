// 랜딩 첫 화면의 코드 몇 줄 + 줄별 풀이 (서버에서만 그림, 상호작용 없음). 글은 맛보기 정본에서 그대로.
import { highlight } from './CodeBlock';
import Inline from './Inline';

export default function MiniCode({ rows, label }: { rows: { code: string; note: string }[]; label: string }) {
  return (
    <figure class="mini-code" aria-label={label} data-testid="landing-code">
      {rows.map((r) => (
        <div class="r">
          <pre class="c">
            <code>{highlight(r.code)}</code>
          </pre>
          <div class="e">
            <Inline text={r.note} />
          </div>
        </div>
      ))}
    </figure>
  );
}
