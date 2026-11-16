// 1 홈·진도 (spec 1절): 이어서 하기, 완료 단계, 이번 주 실습 시간(자동 + 수정), 강의 10편.
import { useState } from 'preact/hooks';
import { config } from '../config';
import { parsePref, practicePrefKey, PREF_RESUME, setPref, STEP_DONE, weeklySeconds } from '../lib/progress';
import { formatDateKo, formatHM, nowKst, weekStartMs } from '../lib/time';
import { useNow, useRuntime, useTables } from './hooks';

interface LectureRow {
  lecture_id: string;
  title_ko: string;
  video_seconds: number;
  available: boolean;
  step_count: number | null;
}
interface Props {
  lectures: LectureRow[];
  main: { lectureId: string; lectureLabel: string; steps: { step_id: string; slug: string; order: number; title_ko: string }[] } | null;
  prereq: { unit_id: string; title_ko: string | null }[];
}

export default function HomeApp(p: Props) {
  const rt = useRuntime();
  const now = useNow(60_000);
  const t = useTables(rt, ['step_progress', 'study_session', 'user_pref']);
  const rows = t?.step_progress ?? [];
  const statusOf = (id: string) => rows.find((r) => r.step_id === id)?.status as string | undefined;
  const steps = p.main?.steps ?? [];
  const doneSteps = rows.filter((r) => STEP_DONE.has(r.status));
  const weekFrom = weekStartMs(now);
  const doneThisWeek = doneSteps.filter((r) => Date.parse(r.done_at ?? '') >= weekFrom).length;
  const started = rows.length > 0;
  const prefKey = practicePrefKey(now);
  const pref = parsePref<{ edited_seconds: number | null }>((t?.user_pref ?? []).find((r) => r.pref_key === prefKey));
  const resume = parsePref<{ step_id: string; phase: string }>((t?.user_pref ?? []).find((r) => r.pref_key === PREF_RESUME));
  // 이어서 하기: 마지막으로 멈춘 단계(아직 안 끝났으면)와 그 안의 칸, 없으면 처음 안 끝난 단계
  const resumeStep = resume ? steps.find((s) => s.step_id === resume.step_id && !STEP_DONE.has(statusOf(s.step_id))) : null;
  const current = resumeStep ?? steps.find((s) => !STEP_DONE.has(statusOf(s.step_id))) ?? null;
  const resumeHash = resumeStep && (resume?.phase === 'practice' || resume?.phase === 'quiz') ? `#${resume.phase}` : '';
  const nextAfter = current ? steps[steps.indexOf(current) + 1] : null;
  const week = weeklySeconds(t?.study_session ?? [], pref, now);
  const mainDone = steps.filter((s) => STEP_DONE.has(statusOf(s.step_id))).length;

  const [editing, setEditing] = useState(false);
  const [h, setH] = useState('0');
  const [m, setM] = useState('0');
  const [err, setErr] = useState<string | null>(null);

  const openEdit = () => {
    const total = Math.floor(week.shown / 60);
    setH(String(Math.floor(total / 60)));
    setM(String(total % 60));
    setErr(null);
    setEditing(true);
  };
  const save = async () => {
    const hh = Number(h);
    const mm = Number(m);
    if (!/^\d{1,2}$/.test(h) || !/^\d{1,2}$/.test(m) || hh > 99 || mm > 59) return setErr('시간은 0~99, 분은 0~59로 적어 주세요.');
    if (rt) await setPref(rt.store, prefKey, { edited_seconds: hh * 3600 + mm * 60, edited_at: nowKst() });
    setEditing(false);
  };
  const revert = async () => {
    // 자동 기록으로 되돌리기: 그 키의 값을 비운다(value null, server/API.md)
    if (rt) await setPref(rt.store, prefKey, null);
    setEditing(false);
  };

  const cpAfter: Record<string, string> = {
    L03: config.checkpointLock === 'lock' ? '누적 점검 1 (01~03편) · 통과하면 04편이 열립니다' : '누적 점검 1 (01~03편) · 04편 전에 권장',
    L06: config.checkpointLock === 'lock' ? '누적 점검 2 (01~06편) · 통과하면 07편이 열립니다' : '누적 점검 2 (01~06편) · 07편 전에 권장',
    L10: '누적 점검 3 (01~10편) · 통과하면 수료',
  };

  return (
    <div class="home">
      <div class="stack">
        <p class="cap">{formatDateKo(now)}</p>
        {p.main && started && current ? (
          <section class="card current stack-sm" aria-label="이어서 하기" data-testid="continue">
            <p class="kicker">이어서 하기</p>
            <h1 class="t1">{p.main.lectureLabel}</h1>
            <p class="num">
              <b>
                단계 {current.order} / {steps.length}
              </b>{' '}
              · {current.title_ko} <span class="cap">{current.step_id}</span>
            </p>
            <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={mainDone} aria-label={`${p.main.lectureLabel} 진도 ${steps.length}단계 중 ${mainDone}단계 완료`}>
              <i style={`width:${Math.round((mainDone / Math.max(1, steps.length)) * 100)}%`} />
            </div>
            <p class="small muted">이 단계: 영상 구간 보기 → 코드 입력 → 결과 비교</p>
            <a class="btn primary block" href={`/lectures/${p.main.lectureId}/${current.slug}/${resumeHash}`} data-testid="continue-link">
              단계 {current.order} 이어서 하기
            </a>
            {nextAfter && (
              <p class="next">
                <b>다음:</b> 단계 {nextAfter.order} · {nextAfter.title_ko}
              </p>
            )}
          </section>
        ) : p.main && started && !current ? (
          <section class="card current stack-sm" aria-label="이어서 하기">
            <p class="kicker">이어서 하기</p>
            <h1 class="t1">{p.main.lectureLabel}</h1>
            <p>모든 단계를 마쳤습니다. 강의 개요에서 재구성 과제와 익힘 판정을 확인하세요.</p>
            <a class="btn primary block" href={`/lectures/${p.main.lectureId}/`}>
              강의 개요 보기
            </a>
          </section>
        ) : (
          <section class="card current stack-sm" aria-label="처음 시작" data-testid="first-day">
            <h1 class="t2">어디서부터 시작할까요?</h1>
            <p>코드를 처음 본다면 사전 기초부터, 파이썬을 조금 읽을 수 있다면 강의 01부터 시작하세요.</p>
            <a class="btn primary block" href="/basics/">
              사전 기초부터
            </a>
            {p.main && (
              <a class="btn block" href={`/lectures/${p.main.lectureId}/${steps[0]?.slug ?? ''}/`}>
                강의 {p.main.lectureLabel}부터
              </a>
            )}
          </section>
        )}

        <section class="card stack-sm" aria-labelledby="lec-h">
          <div class="row">
            <h2 class="t3 grow" id="lec-h">
              강의 {p.lectures.length}편
            </h2>
          </div>
          <ul class="list">
            {p.lectures.map((l) => {
              const n = Number(l.lecture_id.slice(1));
              const isMain = p.main?.lectureId === l.lecture_id;
              const inner = (
                <>
                  <span class={`no num${isMain ? ' st-now' : ''}`}>{l.lecture_id.slice(1)}</span>
                  <span class="main semibold">{l.title_ko}</span>
                  <span class="side small muted">
                    {isMain ? (
                      <span class="num">
                        {mainDone} / {steps.length} 단계
                      </span>
                    ) : (
                      <span>준비 중</span>
                    )}
                    <span class="num" style="display:block">
                      영상 {formatHM(l.video_seconds)}
                    </span>
                  </span>
                </>
              );
              return (
                <li>
                  {l.available ? (
                    <a class="lrow" href={`/lectures/${l.lecture_id}/`}>
                      {inner}
                    </a>
                  ) : (
                    <div class="lrow">{inner}</div>
                  )}
                  {cpAfter[l.lecture_id] && <p class="cp-line">{cpAfter[l.lecture_id]}</p>}
                  {n === 10 && <span class="sr-only">10편은 축소판 실습</span>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div class="home-side stack">
        <h2 class="t2">내 진도</h2>
        <div class="grid2 stats">
          <section class="card stat" aria-label="완료 단계">
            <p class="cap">완료 단계</p>
            <p class="display" data-testid="done-count">
              {t ? doneSteps.length : '–'}
            </p>
            <p class="small muted num">▲+{doneThisWeek} 이번 주</p>
          </section>
          <section class="card stat stack-sm" aria-label="이번 주 실습 시간" data-testid="week-time">
            <p class="cap">이번 주 실습 시간 (시:분)</p>
            {!editing && (
              <button type="button" class="btn ghost sm edit" aria-label="이번 주 실습 시간 수정" onClick={openEdit}>
                수정
              </button>
            )}
            {!editing ? (
              <>
                <p class="display" data-testid="week-time-value">
                  {t ? formatHM(week.shown) : '–'}
                </p>
                {week.user != null && (
                  <p class="small num">
                    <span class="badge">수정됨</span> 자동 {formatHM(week.auto)}
                  </p>
                )}
              </>
            ) : (
              <div class="stack-sm">
                <div class="row">
                  <label class="field">
                    시간
                    <input class="input num-input" inputMode="numeric" value={h} onInput={(e) => setH((e.target as HTMLInputElement).value.trim())} />
                  </label>
                  <label class="field">
                    분
                    <input class="input num-input" inputMode="numeric" value={m} onInput={(e) => setM((e.target as HTMLInputElement).value.trim())} />
                  </label>
                </div>
                {err && (
                  <p class="small" role="alert" style="color:var(--retry)">
                    {err}
                  </p>
                )}
                <div class="row">
                  <button type="button" class="btn" onClick={() => setEditing(false)}>
                    취소
                  </button>
                  <button type="button" class="btn primary" onClick={save}>
                    저장
                  </button>
                </div>
                <button type="button" class="btn ghost sm" onClick={revert}>
                  자동 기록으로 되돌리기
                </button>
              </div>
            )}
          </section>
        </div>
        <p class="small muted">실습 시간은 화면이 열려 있고 사용 중일 때만 자동으로 셉니다. 틀리면 직접 고칠 수 있고, 고친 값에는 수정됨이 붙습니다.</p>

        <section class="card stack-sm" aria-label="오늘 복습">
          <h2 class="t3">오늘 복습</h2>
          <p class="small">오늘 복습할 것이 없습니다.</p>
          <p class="small muted">확인 문제를 풀면 틀린 문제와 핵심 개념이 여기에 모입니다.</p>
          <a class="btn block" href="/review/">
            복습 화면
          </a>
        </section>

        {p.prereq.length > 0 && (
          <section class="card stack-sm" aria-label="사전 기초">
            <p class="kicker">강의 전에 권장</p>
            <h2 class="t3">사전 기초</h2>
            <p class="small">
              01편에 필요한 단위: {p.prereq.map((u) => u.unit_id).join(' · ')}
            </p>
            <a class="btn block" href="/basics/">
              기초 보기
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
