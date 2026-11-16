// 콘텐츠를 읽는 곳은 이 파일 하나다.
// 강의 콘텐츠: 교사 정본 JSON (inputs/pedagogy/content/L??.json). 병합 전에는 app/tests/fixtures/pedagogy/ 의 사본
//   (git show origin/m0-setup:inputs/pedagogy/content/L01.json 으로 꺼낸 것)을 쓴다.
// 영상 구간 정본: 같은 곳의 video-segments.json.
// 보조 목록(선택): lectures.yaml(10편 이름), units.yaml(기초 단위 이름). 저장소 content/ 에 있으면 그것, 없으면 fixtures/extras.
// 바꾸기: Z2H_CONTENT_DIR, Z2H_SEGMENTS, Z2H_EXTRAS_DIR 환경 변수.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { NOTEBOOKS, TASTER } from '../../content-config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(HERE, '../../..');
export const REPO_ROOT = path.resolve(APP_DIR, '..');

export function resolvePaths(env = process.env) {
  const merged = path.join(REPO_ROOT, 'inputs/pedagogy/content');
  const snapshot = path.join(APP_DIR, 'tests/fixtures/pedagogy/content');
  const contentDir = env.Z2H_CONTENT_DIR
    ? path.resolve(env.Z2H_CONTENT_DIR)
    : fs.existsSync(path.join(merged, 'L01.json'))
      ? merged
      : snapshot;
  const source = contentDir === snapshot ? 'snapshot' : 'content';
  const segmentsPath = env.Z2H_SEGMENTS
    ? path.resolve(env.Z2H_SEGMENTS)
    : path.join(path.dirname(contentDir), 'video-segments.json');
  const extrasDir = env.Z2H_EXTRAS_DIR
    ? path.resolve(env.Z2H_EXTRAS_DIR)
    : fs.existsSync(path.join(REPO_ROOT, 'content/lectures.yaml'))
      ? path.join(REPO_ROOT, 'content')
      : path.join(APP_DIR, 'tests/fixtures/extras');
  // 맛보기: 강의 콘텐츠 폴더에 taster.json 이 있으면 그 폴더, 없으면(사본 폴더 등) 교사 정본 폴더
  const tasterDir = env.Z2H_TASTER_DIR
    ? path.resolve(env.Z2H_TASTER_DIR)
    : fs.existsSync(path.join(contentDir, TASTER.file))
      ? contentDir
      : merged;
  return { source, contentDir, segmentsPath, extrasDir, tasterDir, licensesDir: path.join(REPO_ROOT, 'third_party/licenses'), repoRoot: REPO_ROOT };
}

const rel = (p) => path.relative(REPO_ROOT, p);
const listDir = (d) => {
  try {
    return fs.readdirSync(d);
  } catch {
    return [];
  }
};

function readText(file, bundle) {
  const text = fs.readFileSync(file, 'utf8');
  bundle.rawTexts.push({ path: rel(file), text });
  return text;
}

function readJson(file, bundle) {
  try {
    return { path: rel(file), data: JSON.parse(readText(file, bundle)) };
  } catch (e) {
    bundle.parseErrors.push({ path: rel(file), message: String(e?.message ?? e) });
    return { path: rel(file), data: null };
  }
}

function readYaml(file, bundle) {
  try {
    return { path: rel(file), data: YAML.parse(readText(file, bundle), { uniqueKeys: true }) };
  } catch (e) {
    bundle.parseErrors.push({ path: rel(file), message: String(e?.message ?? e) });
    return { path: rel(file), data: null };
  }
}

/** 디스크에서 읽은 그대로의 묶음 (검사 전) */
export function readBundle(paths = resolvePaths()) {
  const bundle = {
    source: paths.source,
    contentDir: rel(paths.contentDir),
    segmentsPath: rel(paths.segmentsPath),
    lectureFiles: [],
    lecturesFile: null,
    unitsFile: null,
    segments: null,
    licenseFiles: listDir(paths.licensesDir),
    notebookExists: {},
    rawTexts: [],
    parseErrors: [],
  };
  const files = listDir(paths.contentDir).filter((f) => /^L\d{2}\.json$/.test(f)).sort();
  if (!files.length) bundle.parseErrors.push({ path: rel(paths.contentDir), message: '강의 콘텐츠 JSON(L01.json 등)이 없습니다' });
  for (const f of files) bundle.lectureFiles.push(readJson(path.join(paths.contentDir, f), bundle));

  const lf = path.join(paths.extrasDir, 'lectures.yaml');
  if (fs.existsSync(lf)) bundle.lecturesFile = readYaml(lf, bundle);
  const uf = [path.join(paths.extrasDir, 'units.yaml'), path.join(paths.extrasDir, 'ep00-basics/units.yaml')].find((p) => fs.existsSync(p));
  if (uf) bundle.unitsFile = readYaml(uf, bundle);

  try {
    bundle.segments = JSON.parse(fs.readFileSync(paths.segmentsPath, 'utf8'));
  } catch (e) {
    bundle.parseErrors.push({ path: rel(paths.segmentsPath), message: `영상 구간 파일을 읽지 못했습니다: ${e?.message ?? e}` });
  }
  for (const nb of Object.values(NOTEBOOKS)) bundle.notebookExists[nb.student] = fs.existsSync(path.join(paths.repoRoot, nb.student));
  return bundle;
}

/** 맛보기 묶음 (검사 전): taster.json + 교사 실행 출력 taster_outputs.json + 노트북 있는지 */
export function readTasterBundle(paths = resolvePaths()) {
  const bundle = { file: null, outputsFile: null, notebookPath: TASTER.notebook, notebookExists: false, rawTexts: [], parseErrors: [] };
  const f = path.join(paths.tasterDir, TASTER.file);
  if (fs.existsSync(f)) bundle.file = readJson(f, bundle);
  else bundle.parseErrors.push({ path: rel(f), message: '맛보기 콘텐츠(taster.json)가 없습니다' });
  const o = path.join(paths.tasterDir, TASTER.outputsFile);
  if (fs.existsSync(o)) bundle.outputsFile = readJson(o, bundle);
  else bundle.parseErrors.push({ path: rel(o), message: '교사 실행 출력(taster_outputs.json)이 없습니다' });
  bundle.notebookExists = fs.existsSync(path.join(paths.repoRoot, TASTER.notebook));
  return bundle;
}

export function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath));
}
