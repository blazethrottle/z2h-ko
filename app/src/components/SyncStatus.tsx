// 상단 바 동기화 표시 (spec 0.6): ✓ 저장됨 / ↻ 동기화 중(1초 넘을 때만) / ✕ 오프라인 + 지금 다시 시도
// 서버가 계정 없음(401)이면 오프라인과 구분해 "계정을 골라 주세요" (설정의 개발용 계정으로 이동)
// 계정·첫 서버 확인이 끝나기 전(정적 HTML 포함)은 checking: 옅은 글자 "확인 중"을 보인다(spec 0.6 "늘 표시", P2 검수 권고).
// "저장됨"은 계정과 첫 확인이 끝난 뒤에만 보인다
import { useState } from 'preact/hooks';
import { useRuntime, useSyncState } from './hooks';
import { IconCheck, IconCross, IconSync } from './Icons';
import { gated } from './Gate';

function SyncStatusView() {
  const rt = useRuntime();
  const s = useSyncState(rt);
  const [open, setOpen] = useState(false);
  const display = s?.display ?? 'checking';

  return (
    <div class="sync" data-testid="sync-status">
      <span role="status" aria-live="polite">
        {display === 'checking' ? (
          <span class="sync-btn checking" data-state="checking">
            <span class="sr-only">동기화 상태 </span>확인 중
          </span>
        ) : display === 'account' ? (
          <a class="sync-btn account" href="/settings/#account" data-state="account">
            계정을 골라 주세요
          </a>
        ) : display === 'offline' ? (
          <button class="sync-btn offline" type="button" aria-expanded={open} onClick={() => setOpen(!open)} data-state="offline">
            <IconCross size={14} /> 오프라인
          </button>
        ) : display === 'syncing' ? (
          <span class="sync-btn syncing" data-state="syncing">
            <IconSync size={14} /> 동기화 중
          </span>
        ) : (
          <span class="sync-btn saved" data-state="saved">
            <IconCheck size={14} /> 저장됨
          </span>
        )}
      </span>
      {display === 'offline' && open && (
        <div class="card sync-card stack-sm" role="dialog" aria-label="동기화 안내">
          <p class="small">맥미니 서버에 연결하지 못했습니다. 이 기기에 먼저 저장해 두었고, 연결되면 자동으로 다시 보냅니다.</p>
          {s && s.pending > 0 && <p class="cap num">보낼 기록 {s.pending}건</p>}
          <button
            type="button"
            class="btn primary block"
            onClick={() => {
              setOpen(false);
              void rt?.sync.retryNow();
            }}
          >
            지금 다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

/** 마운트 전에는 안의 버튼·입력칸이 눌리지 않게 감싼다(Gate.tsx) */
export default gated(SyncStatusView, 'SyncStatus');
