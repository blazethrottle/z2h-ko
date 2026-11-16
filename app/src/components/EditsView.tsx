// 바뀐 줄만 보여 주기 (spec 4.2-1, data-spec v1.2 edits). 비교(diff) 도구 없이:
// 고칠 곳마다 기준 줄(anchor_line)을 흐리게 한 줄, 그 아래 넣을 줄을 강조. "전체 보기"는 고친 뒤 셀 전체.
import { useState } from 'preact/hooks';
import CodeBlock, { CopyButton, highlight } from './CodeBlock';
import Inline from './Inline';

export interface EditBlock {
  target_step: string;
  where_ko: string;
  action: 'insert' | 'replace';
  anchor_line: string | null;
  line_count: number;
  lines: string[];
  notes: string[];
}
export interface EditView {
  blocks: EditBlock[];
  rest: { lines: string[]; notes: string[] };
  targets: { step_id: string; title_ko: string; slug: string; full: { ok: boolean; lines: { text: string; isNew: boolean }[] } }[];
}

const before = (ln: string) => ln.replace(/^(\s*)#\s?/, '$1');

function Line({ text, cls, note, tag }: { text: string; cls: string; note?: string; tag?: string }) {
  return (
    <div class={`cl-row ${cls}${note ? ' open' : ''}`}>
      <div class="cl-code static">
        {tag && <span class="edit-tag">{tag}</span>}
        <code>{highlight(text)}</code>
      </div>
      {note != null && <div class="cl-note">{note}</div>}
    </div>
  );
}

export default function EditsView({ view }: { view: EditView }) {
  const [full, setFull] = useState(false);
  const target = view.targets[0];
  const insertText = view.blocks.flatMap((b) => b.lines).join('\n');
  return (
    <>
      <section class="codeblock edits" aria-label="바뀐 줄만" data-testid="edits-view">
        <div class="cb-head">
          <span class="grow">
            바뀐 줄만 · {target?.step_id} {target?.title_ko} 셀
          </span>
          <button type="button" class="btn sm" aria-expanded={full} onClick={() => setFull(!full)} data-testid="edits-full">
            전체 보기
          </button>
          <CopyButton text={insertText} label="넣을 줄 복사" />
        </div>
        {!full ? (
          <>
            <p class="edits-note">흐린 줄은 이미 있는 기준 줄입니다. 그 바로 아래에 밝게 표시한 줄을 넣습니다.</p>
            {view.blocks.map((b, i) => (
              <div class="edit-block" data-testid="edit-block">
                <p class="edit-title">
                  {i + 1} / {view.blocks.length} · <Inline text={b.where_ko} /> · {b.line_count}줄 {b.action === 'replace' ? '바꾸기' : '넣기'}
                </p>
                <Line text="…" cls="anchor" />
                {b.action === 'replace'
                  ? b.lines.map((ln) => <Line text={before(ln)} cls="anchor" tag="바꾸기 전" />)
                  : b.anchor_line
                    ? [<Line text={b.anchor_line} cls="anchor" tag="기준 줄" />]
                    : [<Line text="(셀 맨 아래)" cls="anchor" />]}
                {b.lines.map((ln, k) => (
                  <Line text={ln} cls="new" note={b.notes[k] ?? ''} tag={b.action === 'replace' ? '바꾼 뒤' : '넣을 줄'} />
                ))}
                <Line text="…" cls="anchor" />
              </div>
            ))}
          </>
        ) : target?.full.ok ? (
          <div data-testid="edits-full-cell">
            {target.full.lines.map((l) => (
              <Line text={l.text} cls={l.isNew ? 'new' : ''} tag={l.isNew ? '새 줄' : undefined} />
            ))}
          </div>
        ) : (
          <p class="edits-note">이 셀 전체 모습을 만들지 못했습니다. 위 고칠 곳을 차례로 넣어 주세요.</p>
        )}
      </section>
      {view.rest.lines.length > 0 && <CodeBlock code={view.rest.lines.join('\n')} notes={view.rest.notes} heading={`새 셀에 칠 줄 ${view.rest.lines.length}줄 · 줄을 누르면 풀이`} testId="step-code" />}
    </>
  );
}
