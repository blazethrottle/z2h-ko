// 코드 줄 + 줄별 풀이 (spec 4.2). 데스크톱 2단 격자, 모바일은 줄을 눌러 아래에 풀이가 펼쳐지는 1단.
// DOM 순서는 늘 "코드 줄 다음 풀이". 복사는 주석 없는 코드 그대로(decisions C2).
import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { IconCheck, IconCopy } from './Icons';

const KW = new Set([
  'def', 'class', 'return', 'for', 'in', 'if', 'elif', 'else', 'while', 'import', 'from', 'as', 'lambda', 'None', 'True', 'False',
  'and', 'or', 'not', 'is', 'with', 'try', 'except', 'finally', 'raise', 'pass', 'break', 'continue', 'yield', 'global', 'nonlocal', 'assert', 'del',
]);
const TOKEN = /(#.*$)|([rbfRBF]{0,2}"(?:[^"\\]|\\.)*"|[rbfRBF]{0,2}'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d*)?(?:[eE][-+]?\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g;

export function highlight(line: string) {
  const out: (string | JSX.Element)[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    const [t, c, s, n, w] = m;
    if (c) out.push(<span class="tok-c">{c}</span>);
    else if (s) out.push(<span class="tok-s">{s}</span>);
    else if (n) out.push(<span class="tok-n">{n}</span>);
    else if (w && KW.has(w)) out.push(<span class="tok-k">{w}</span>);
    else out.push(t);
    last = i + t.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function splitLines(code: string | null | undefined): string[] {
  if (!code) return [];
  const s = code.replace(/\n+$/, '');
  return s === '' ? [] : s.split('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
  return (
    <>
      <button
        type="button"
        class="btn sm"
        onClick={async () => {
          const ok = await copyText(text);
          setState(ok ? 'ok' : 'fail');
          setTimeout(() => setState('idle'), 2000);
        }}
      >
        {state === 'ok' ? <IconCheck /> : <IconCopy />} {state === 'ok' ? '복사됨' : label}
      </button>
      <span class="sr-only" aria-live="polite">
        {state === 'ok' ? '복사됨' : state === 'fail' ? '복사하지 못했습니다. 코드를 길게 눌러 직접 복사해 주세요.' : ''}
      </span>
    </>
  );
}

export default function CodeBlock({
  code,
  notes,
  heading,
  testId,
}: {
  code: string;
  notes: string[];
  heading: string;
  testId?: string;
}) {
  const lines = splitLines(code);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    const n = new Set(open);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    setOpen(n);
  };
  return (
    <section class="codeblock" aria-label={heading} data-testid={testId}>
      <div class="cb-head">
        <span class="grow">{heading}</span>
        <CopyButton text={lines.join('\n')} />
      </div>
      <div class="cl-cols" aria-hidden="true">
        <span>코드</span>
        <span>한국어 풀이</span>
      </div>
      <div>
        {lines.map((ln, i) => (
          <div class={`cl-row${open.has(i) ? ' open' : ''}`}>
            <button type="button" class="cl-code" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
              <span class="ln">{i + 1}</span>
              <code>{highlight(ln)}</code>
            </button>
            <div class="cl-note">{notes[i] ?? ''}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
