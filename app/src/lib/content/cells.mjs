// 셀 모양 계산(1편·기초 공통, 검사와 화면 데이터가 같이 쓴다): edits 나누기, 고친 뒤 셀 전체, 새 셀 나누기.
const byOrder = (a, b) => a.order - b.order;
const splitLines = (code) => (code == null ? [] : String(code).replace(/\n+$/, '').split('\n'));
const norm = (s) => String(s).trim();

/** edits 를 나눈다: code 앞쪽 줄이 edits 순서대로 넣을 줄, 나머지는 새 셀 (data-spec v1.2) */
export function splitEdits(step) {
  const lines = splitLines(step.code);
  const notes = step.code_line_notes_ko ?? [];
  let at = 0;
  const blocks = (step.edits ?? []).map((e) => {
    const b = { ...e, lines: lines.slice(at, at + e.line_count), notes: notes.slice(at, at + e.line_count) };
    at += e.line_count;
    return b;
  });
  return { blocks, rest: { lines: lines.slice(at), notes: notes.slice(at) } };
}

/** 대상 셀에 앞 단계들의 edits 를 차례로 적용한 "고친 뒤 셀 전체". 기준 줄을 못 찾으면 ok:false */
export function reconstructCell(steps, step, targetId) {
  const target = steps.find((s) => s.step_id === targetId);
  if (!target) return { ok: false, lines: [] };
  let cell = splitLines(target.code).map((text) => ({ text, isNew: false }));
  let ok = true;
  const upto = [...steps].sort(byOrder).filter((s) => s.order <= step.order && s.order > target.order);
  for (const s of upto) {
    const { blocks } = splitEdits(s);
    for (const b of blocks.filter((x) => x.target_step === targetId)) {
      const mine = s.step_id === step.step_id;
      const add = b.lines.map((text) => ({ text, isNew: mine }));
      if (b.action === 'replace') {
        // 바꾸기: 기준 줄(바꾸기 전 줄)부터 line_count 줄을 새 줄로 바꾼다. 기준 줄이 없는 바꾸기는 검사가 막는다(stepCellIssues)
        let idx = -1;
        cell.forEach((l, i) => {
          if (idx < 0 && norm(l.text) === norm(b.anchor_line ?? '')) idx = i;
        });
        if (idx < 0) {
          ok = false;
          continue;
        }
        cell = [...cell.slice(0, idx), ...add, ...cell.slice(idx + b.line_count)];
      } else if (b.anchor_line) {
        let idx = -1;
        cell.forEach((l, i) => {
          if (norm(l.text) === norm(b.anchor_line)) idx = i;
        });
        if (idx < 0) {
          ok = false;
          continue;
        }
        cell = [...cell.slice(0, idx + 1), ...add, ...cell.slice(idx + 1)];
      } else {
        // "셀 맨 아래": 클래스처럼 들여 쓴 덩어리의 마지막 줄 바로 아래 (뒤에 붙은 확인용 줄 앞)
        let idx = cell.length - 1;
        for (let i = cell.length - 1; i >= 0; i--) {
          if (/^\s+\S/.test(cell[i].text)) {
            idx = i;
            break;
          }
        }
        cell = [...cell.slice(0, idx + 1), ...add, ...cell.slice(idx + 1)];
      }
    }
  }
  return { ok, lines: cell };
}

/** 새 셀(edits 로 앞 셀에 넣는 줄을 뺀 나머지)을 cell_line_counts 대로 나눈다. 칸이 없으면 셀 하나 */
export function splitCells(step) {
  const { rest } = splitEdits(step);
  const counts = Array.isArray(step.cell_line_counts) ? step.cell_line_counts : rest.lines.length ? [rest.lines.length] : [];
  let at = 0;
  return counts.map((n) => {
    const c = { lines: rest.lines.slice(at, at + n), notes: rest.notes.slice(at, at + n) };
    at += n;
    return c;
  });
}
