// 결과코드 붙여넣기 (12.7절). 브라우저에서 풀어 검사하고 grade_result(+재구성은 rebuild_attempt)로 저장한다.
// 이미 통과한 칸의 다시(f)는 저장하지 않고 "전에 통과해서 통과로 둠"으로 알린다(lib/resultCode.ts keepPasses).
import { useState } from 'preact/hooks';
import { decodeResultCode, keepPasses, resultCodeToRows } from '../lib/resultCode';
import type { Row } from '../lib/sync/store';
import type { Runtime } from '../lib/runtime';
import type { HintState } from '../lib/hints';
import { nowKst } from '../lib/time';
import { keepLegacyBeforeWrite } from '../lib/migrate/run';
import { IconCheck, IconCross } from './Icons';

/** rebuildIds: 이 편 정본 rebuild_tasks 의 id(결과코드에서 재구성 조각을 알아보는 데 쓴다). grades: 이 계정의 지금 grade_result 행 */
export default function ResultCodePaste({ rt, lectureId, rebuildIds, grades }: { rt: Runtime | null; lectureId: string; rebuildIds: string[]; grades: Row[] }) {
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
    const rows = resultCodeToRows(d.data, nowKst(), (id) => levels[id] ?? 0, rebuildIds);
    const kept = keepPasses(rows.grade, grades);
    // 같은 칸의 옛 1.2판 결과는 덮기 전에 보관본에(lib/migrate)
    await keepLegacyBeforeWrite(rt.store, 'grade_result', kept.rows);
    // 변경 시각 = 코드 안의 채점 시각(t). 더 늦게 채점한 결과가 이기게 한다(서버 충돌 규칙)
    for (const g of kept.rows) await rt.store.put('grade_result', g, g.at);
    for (const r of rows.rebuild) await rt.store.put('rebuild_attempt', r, r.at);
    const passed = rows.grade.filter((g) => g.passed).length;
    setRes({
      ok: true,
      title: `결과 ${rows.grade.length}개를 반영했습니다`,
      lines: [
        `통과 ${passed}개, 다시 ${rows.grade.length - passed}개`,
        ...rows.grade.map((g) => `${g.check_id}: ${g.passed ? '통과' : kept.keptPass.includes(g.check_id) ? '다시(전에 통과해서 통과로 둠)' : '다시'}${g.message_ko ? ` · ${g.message_ko}` : ''}`),
      ],
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
