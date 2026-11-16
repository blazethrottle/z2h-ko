#!/usr/bin/env node
// npm run check:content : 콘텐츠 빌드 검사 (DESIGN.md 12.4절 + PM 계약 보충).
// 교사 정본 inputs/pedagogy/content/L??.json 이 있으면 그것을, 없으면(병합 전) app/tests/fixtures/pedagogy 의 사본을 검사한다.
// 맛보기(taster.json + taster_outputs.json)도 같은 규칙 묶음으로 검사한다.
// 종료 코드: 통과 0, 실패 1.
import { readBundle, readTasterBundle, resolvePaths } from '../src/lib/content/load.mjs';
import { formatReport, validateBundle } from '../src/lib/content/validate.mjs';
import { formatTasterReport, validateTaster } from '../src/lib/content/taster.mjs';

const paths = resolvePaths();
const bundle = readBundle(paths);
const report = validateBundle(bundle);
console.log(formatReport(report, bundle.source, bundle.contentDir));
const tb = readTasterBundle(paths);
const treport = validateTaster(tb);
console.log(formatTasterReport(treport, tb.file?.path ?? 'taster.json'));
process.exit(report.errors.length || treport.errors.length ? 1 : 0);
