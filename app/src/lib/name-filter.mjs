// 맛보기 이름 카드 금칙어 (교사 정본 inputs/pedagogy/content/taster_blocklist.json). 빌드(node)와 브라우저가 같이 쓰는 순수 함수.
// 규칙(정본 rule·allow_rule):
//   1) 정본 normalize: 소문자로 바꾼 뒤 a~z 만 남긴다.
//   2) 허용이 먼저: 줄 전체가 names.txt 의 실제 이름이면 금칙어 검사를 건너뛴다.
//   3) exact 목록과 줄 전체가 같거나, substring 목록 단어가 줄 안에 있으면 그 줄을 저장과 카드에서 뺀다.
// 앱의 줄 정리(src/lib/taste.ts cleanNames)는 기존 규칙(a~z 밖 글자가 있거나 20글자 넘는 줄은 빼기)을 이 검사보다 먼저 한다.
// 목록은 빌드 때 정본에서 읽어(src/lib/content/taster.mjs) 화면 부품에 넘긴다. 이 파일에 목록을 적지 않는다.

/**
 * @typedef {{ version: string, exact: string[], substring: string[], allow: string[], message: string }} NameFilter
 * allow: names.txt 의 이름 가운데 exact·substring 에 걸리는 것만(허용 목록). 나머지 실제 이름은 원래 걸리지 않으므로 싣지 않아도 결과가 같다.
 * message: 걸린 줄이 있을 때 보이는 안내(정본 on_match_ko 의 따옴표 안 글).
 */

/** 정본 normalize: 소문자로 바꾼 뒤 a~z 만 */
export function normalizeName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** names.txt 글 → 이름 목록 (Python splitlines 처럼 줄 끝 줄바꿈은 줄로 세지 않는다) */
export function splitNameLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((l, i, a) => !(i === a.length - 1 && l === ''));
}

/** 허용 규칙 없이 목록에만 걸리는지 (n 은 normalize 한 줄) */
export function hitsBlocklist(n, lists) {
  if (!n) return false;
  return lists.exact.includes(n) || lists.substring.some((w) => n.includes(w));
}

/** 그 줄을 빼야 하는가: 허용(실제 이름)이 먼저, 그다음 exact·substring. 필터가 없으면 false */
export function isBlockedName(line, filter) {
  if (!filter) return false;
  const n = normalizeName(line);
  if (!n || filter.allow.includes(n)) return false;
  return hitsBlocklist(n, filter);
}

/** 정본 on_match_ko("… '이름을 몇 개 뺐어요. …'를 보여 줍니다") → 화면 문구. 따옴표가 없으면 null */
export function onMatchMessage(onMatchKo) {
  const m = /'([^']+)'/.exec(String(onMatchKo ?? ''));
  return m ? m[1].trim() : null;
}

const words = (list) => [...new Set((Array.isArray(list) ? list : []).map(normalizeName).filter(Boolean))];

/** 빌드 때: 정본 목록 + names.txt 이름 → 앱에 싣는 필터 */
export function buildNameFilter(blocklist, realNames) {
  const lists = { exact: words(blocklist?.exact), substring: words(blocklist?.substring) };
  const allow = [...new Set((realNames ?? []).map(normalizeName).filter((n) => hitsBlocklist(n, lists)))].sort();
  return {
    version: String(blocklist?.version ?? ''),
    exact: lists.exact,
    substring: lists.substring,
    allow,
    message: onMatchMessage(blocklist?.on_match_ko) ?? '',
  };
}

/** 콘텐츠 검사: 정본 모양과 names.txt 를 확인한다 → 오류 글 목록 (빈 목록이면 통과) */
export function checkBlocklist(blocklist, realNames, expectedCount) {
  const errs = [];
  if (!blocklist || typeof blocklist !== 'object') return ['금칙어 정본을 읽지 못했습니다'];
  for (const k of ['exact', 'substring']) {
    const v = blocklist[k];
    if (!Array.isArray(v) || !v.length) errs.push(`${k} 는 글자 목록이어야 합니다`);
    else
      v.forEach((w, i) => {
        if (typeof w !== 'string' || !normalizeName(w)) errs.push(`${k}[${i}] 이 비었거나 a~z 가 없습니다`);
        else if (normalizeName(w) !== w) errs.push(`${k}[${i}] 이 정본 normalize(소문자 a~z) 모양이 아닙니다`);
      });
  }
  if (!onMatchMessage(blocklist.on_match_ko)) errs.push("on_match_ko 에 화면 문구('…')가 없습니다");
  if (!Array.isArray(realNames)) errs.push('names.txt 를 읽지 못했습니다');
  else {
    if (realNames.length !== expectedCount) errs.push(`names.txt 줄 수가 ${realNames.length}개입니다(기대 ${expectedCount}개)`);
    const bad = realNames.findIndex((n) => !/^[a-z]+$/.test(n));
    if (bad >= 0) errs.push(`names.txt ${bad + 1}번째 줄이 a~z 이름이 아닙니다`);
  }
  return errs;
}
