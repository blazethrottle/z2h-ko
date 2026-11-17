// 결과코드 붙여넣기 (12.7절). 브라우저에서 풀어 검사하고 grade_result(+재구성은 rebuild_attempt)로 저장한다.
import { useState } from 'preact/hooks';
import { decodeResultCode, resultCodeToRows } from '../lib/resultCode';
import type { Runtime } from '../lib/runtime';
import type { HintState } from '../lib/hints';
import { nowKst } from '../lib/time';
import { IconCheck, IconCross } from './Icons';

export default function ResultCodePaste({ rt, lectureId }: { rt: Runtime | null; lectureId: string }) {
  const [code, setCode] = useState('');
  const [res, setRes] = useState<{ ok: boolean; title: string; lines: string[] } | null>(null);

  const apply = async () => {
    const d = decodeResultCode(code);
    if (!d.ok) return setRes({ ok: false, title: '다시', lines: [d.error_ko, '노트북의 finish() 칸이 출력한 코드를 처음부터 끝까지 그대로 복사해 주세요.'] });
    if (d.data.lecture_id && d.data.lecture_id !== lectureId)
      return setRes({ ok: false, title: '다시', lines: [`이 코드는 ${d.data.lecture_id} 강의의 결과입니다. 그 강의 화면에 붙여 넣어 주세요.`] });
    if (!rt) return;
    const levels: Record<string, number> = {};
    for (const r of d.data.results) {
      const h = await rt.store.getUi<HintState>(`hint:${r.check_id}`);
      levels[r.check_id] = h?.opened ?? 0;
    }
    const rows = resultCodeToRows(d.data, nowKst(), (id) => levels[id] ?? 0);
    // 변경 시각 = 코드 안의 채점 시각(t). 더 늦게 채점한 결과가 이기게 한다(서버 충돌 규칙)
    for (const g of rows.grade) await rt.store.put('grade_result', g, g.at);
    for (const r of rows.rebuild) await rt.store.put('rebuild_attempt', r, r.at);
    const passed = rows.grade.filter((g) => g.passed).length;
    setRes({
      ok: true,
      title: `결과 ${rows.grade.length}개를 반영했습니다`,
      lines: [`통과 ${passed}개, 다시 ${rows.grade.length - passed}개`, ...rows.grade.map((g) => `${g.check_id}: ${g.passed ? '통과' : '다시'}${g.message_ko ? ` · ${g.message_ko}` : ''}`)],
    });
    setCode('');
  };

  return (
    <section class="card stack-sm" aria-label="결과코드 붙여넣기" id="result-code" data-testid="result-code">
      <h2 class="t3">노트북 채점 결과 붙여넣기</h2>
      <p class="small">노트북 마지막 칸의 finish("{lectureId}")가 출력한 Z2H1로 시작하는 코드를 붙여 넣으면 채점 결과가 진도에 들어갑니다.</p>
      <textarea class="input code-input" aria-label="결과코드" value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} placeholder="Z2H1.…" />
      <button type="button" class="btn" onClick={apply} data-testid="apply-result-code">
        반영하기
      </button>
      {res && (
        <div class={`result ${res.ok ? 'ok' : 'ng'}`} role="status" data-testid="result-code-status">
          <span class="sym">{res.ok ? <IconCheck size={20} /> : <IconCross size={20} />}</span>
          <div class="stack-sm">
            <p class="title">{res.title}</p>
            {res.lines.map((l) => (
              <p class="small">{l}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
