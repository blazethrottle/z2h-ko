// 콘텐츠 글 → 조각 (Inline.tsx 가 그린다): 글자, `백틱` 인라인 코드, 줄바꿈, (bold 를 켠 글만) **굵게**.
// 백틱 구간은 한 줄 안에서만 찾는다(줄을 넘는 백틱은 글자 그대로).
// **굵게** 는 기본으로 끈다: 정본 글의 ** 는 대개 파이썬 거듭제곱 기호라서. 진단 목적(purpose_ko)처럼 강조를 쓰는 글만 켠다.

export type InlinePart = { kind: 'text' | 'code' | 'strong'; value: string } | { kind: 'br' };

export function inlineParts(text: string | null | undefined, opts: { bold?: boolean } = {}): InlinePart[] {
  const out: InlinePart[] = [];
  String(text ?? '')
    .split('\n')
    .forEach((line, i) => {
      if (i > 0) out.push({ kind: 'br' });
      for (const p of line.split(/(`[^`\n]+`)/g)) {
        if (!p) continue;
        if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) {
          out.push({ kind: 'code', value: p.slice(1, -1) });
          continue;
        }
        if (!opts.bold) {
          out.push({ kind: 'text', value: p });
          continue;
        }
        for (const b of p.split(/(\*\*[^*\n]+\*\*)/g)) {
          if (!b) continue;
          if (b.length > 4 && b.startsWith('**') && b.endsWith('**')) out.push({ kind: 'strong', value: b.slice(2, -2) });
          else out.push({ kind: 'text', value: b });
        }
      }
    });
  return out;
}
