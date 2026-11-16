// 설정: 동기화 상태, 개발용 계정 바꾸기, 실행 장소, JSON 백업 내보내기 (12.3절, D43·D44).
// 계정은 로컬 개발용 로그인만(127.0.0.1 전용). 이메일·Google 로그인은 자리 문구만, X 로그인은 없다.
import { useEffect, useRef, useState } from 'preact/hooks';
import { API_PATHS, listDevAccounts, type Account } from '../lib/api';
import { createAndUseDevAccount, switchDevAccount } from '../lib/runtime';
import { config } from '../config';
import { parsePref, PREF_RUN_PLACE, setPref } from '../lib/progress';
import { useRuntime, useSyncState, useTables } from './hooks';
import { IconCheck, IconCross, IconSync } from './Icons';
import { gated } from './Gate';

function SettingsAppView({ contentVersion }: { contentVersion: string | null }) {
  const rt = useRuntime();
  const s = useSyncState(rt);
  const t = useTables(rt, ['user_pref']);
  const run = parsePref<string>((t?.user_pref ?? []).find((r) => r.pref_key === PREF_RUN_PLACE)) === 'jupyter' ? 'jupyter' : 'colab';
  const [exported, setExported] = useState<string | null>(null);

  const exportLocal = async () => {
    if (!rt) return;
    const data = await rt.store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const day = data.exported_at.slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `z2h-backup-${day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const n = Object.values(data.tables).reduce((acc, rows) => acc + rows.length, 0);
    setExported(`기록 ${n}건, 보낼 변경 ${data.pending_ops.length}건을 내려받았습니다.`);
  };

  const display = s?.display ?? 'checking';
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [serverCurrent, setServerCurrent] = useState<string | null>(null);
  const [acctErr, setAcctErr] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  // 목록은 화면을 열 때 한 번, 계정 확인(rt)이 끝난 뒤 한 번 더 받는다(처음 여는 기기는 그 사이에 계정이 생긴다).
  // 늦게 도착한 앞 요청의 응답이 뒤 요청의 응답을 덮지 않게 번호를 붙인다
  const loadSeq = useRef(0);
  const loadAccounts = () => {
    const seq = ++loadSeq.current;
    return listDevAccounts((u, i) => fetch(u, i))
      .then((r) => {
        if (seq !== loadSeq.current) return;
        setAccounts(r.accounts);
        setServerCurrent(r.current_user_id);
        setAcctErr(null);
      })
      .catch(() => {
        if (seq === loadSeq.current) setAcctErr('계정 목록을 불러오지 못했습니다. 맥미니 서버가 켜져 있는지 확인해 주세요.');
      });
  };
  useEffect(() => {
    void loadAccounts();
  }, [rt]);
  // 지금 계정: 화면의 계정 확인이 끝났으면 그 값, 아직이면 목록 응답의 current_user_id.
  // 둘 다 모르면 목록을 그리지 않는다(모든 줄에 "이 계정으로 바꾸기"가 잠깐 보이지 않게)
  const currentId = rt?.account?.user_id ?? serverCurrent;
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setAcctErr('계정을 바꾸지 못했습니다. 이 컴퓨터(127.0.0.1)에서 연 화면에서만 쓸 수 있습니다.');
      setBusy(false);
    }
  };
  return (
    <div class="stack">
      <h1 class="t1">설정</h1>
      <section class="card stack-sm" id="account" aria-labelledby="account-h" data-testid="settings-account">
        <div class="row">
          <h2 class="t3" id="account-h">
            계정
          </h2>
          <span class="devtag">개발용</span>
        </div>
        <p class="small">
          지금 계정: <b data-testid="current-account">{rt?.account?.display_name ?? rt?.account?.user_id ?? (rt ? '없음' : '–')}</b>
        </p>
        <p class="cap">이 컴퓨터에서만 쓰는 개발용 로그인입니다. 비밀번호가 없고, 계정마다 기록과 이 기기 저장이 따로 있습니다.</p>
        {acctErr && (
          <p class="small" role="alert" style="color:var(--retry)">
            {acctErr}
          </p>
        )}
        {accounts && accounts.length > 0 && (rt || currentId) && (
          <ul class="list" data-testid="account-list">
            {accounts.map((a) => (
              <li class="lrow">
                <span class="main">{a.display_name ?? a.user_id}</span>
                {a.user_id === currentId ? (
                  <span class="badge cur" data-testid="account-current">
                    사용 중
                  </span>
                ) : (
                  <button type="button" class="btn sm" disabled={busy} onClick={() => act(() => switchDevAccount(a.user_id))}>
                    이 계정으로 바꾸기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <label class="field">
          새 계정 이름
          <input class="input" value={newName} placeholder={`${config.devAccountName} ${(accounts?.length ?? 0) + 1}`} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} />
        </label>
        <button
          type="button"
          class="btn"
          disabled={busy}
          onClick={() => act(() => createAndUseDevAccount(newName.trim() || `${config.devAccountName} ${(accounts?.length ?? 0) + 1}`))}
          data-testid="create-account"
        >
          새 개발용 계정 만들기
        </button>
        <p class="cap">이메일·Google 로그인은 공개 승인 뒤에 넣습니다.</p>
      </section>
      <section class="card stack-sm" aria-label="동기화 상태" data-testid="settings-sync">
        <h2 class="t3">동기화 상태</h2>
        <p class="label" style={display === 'offline' ? 'color:var(--retry)' : display === 'saved' ? 'color:var(--correct)' : 'color:var(--ink-muted)'}>
          {display === 'offline' ? <IconCross /> : display === 'syncing' ? <IconSync /> : display === 'saved' ? <IconCheck /> : null}{' '}
          {display === 'offline' ? '오프라인' : display === 'syncing' ? '동기화 중' : display === 'account' ? '계정을 골라 주세요' : display === 'saved' ? '저장됨' : '확인 중'}
        </p>
        <ul class="small num">
          <li>보낼 변경: {s ? `${s.pending}건` : '–'}</li>
          <li>마지막으로 서버에 저장한 시각: {s?.lastSyncedAt ?? '–'}</li>
          {s?.lastError && display === 'offline' && <li>연결 오류: {s.lastError}</li>}
          {s && s.rejected.length > 0 && <li>서버가 받지 않은 변경: {s.rejected.length}건 (최근: {s.rejected[s.rejected.length - 1].reason_ko})</li>}
        </ul>
        <p class="small muted">진도는 이 기기에 먼저 저장한 뒤 맥미니 서버로 보냅니다. 연결이 끊겨도 계속 학습할 수 있습니다.</p>
        <button type="button" class="btn" onClick={() => void rt?.sync.retryNow()}>
          지금 다시 시도
        </button>
      </section>

      <section class="card stack-sm" aria-label="실행 장소">
        <h2 class="t3">노트북 실행 장소</h2>
        <div class="row" role="group" aria-label="실행 장소">
          {(['colab', 'jupyter'] as const).map((loc) => (
            <button type="button" class="chip" aria-pressed={run === loc} onClick={() => rt && setPref(rt.store, PREF_RUN_PLACE, loc)}>
              {loc === 'colab' ? 'Google Colab (기본)' : '맥미니 Jupyter (선택)'}
            </button>
          ))}
        </div>
        <p class="small muted">단계 화면의 실행 안내가 이 선택을 따릅니다. 다른 기기와도 맞춰집니다.</p>
      </section>

      <section class="card stack-sm" aria-label="백업 내보내기">
        <h2 class="t3">백업 내보내기</h2>
        <button type="button" class="btn" onClick={exportLocal} data-testid="export-local">
          이 기기 기록을 JSON으로 내려받기
        </button>
        {exported && (
          <p class="small" role="status">
            {exported}
          </p>
        )}
        <a class="btn ghost" href={API_PATHS.export} download="z2h-server-backup.json">
          서버 전체 백업 받기 (서버가 켜져 있을 때)
        </a>
      </section>

      <p class="cap">콘텐츠 버전: {contentVersion ?? '–'}</p>
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(SettingsAppView, 'SettingsApp');
