#!/bin/bash
# Z2H PM 발사 스크립트. CTO가 검토 후 직접 실행한다. 대화형 전용(-p 금지).
# PM = Fable 5.2 medium, 서브 = Opus 5.5 xhigh (z2h-run.settings.json FORCE + 정의 파일)
set -euo pipefail
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH"
REPO="$HOME/MonkeyHub/repos/z2h-ko"
cd "$REPO"
if [ -n "${CLAUDE_CODE_EFFORT_LEVEL:-}" ]; then echo "중단: CLAUDE_CODE_EFFORT_LEVEL 이 설정돼 있음(서브 xhigh가 눌림)"; exit 1; fi
if tmux has-session -t z2h-pm 2>/dev/null; then echo "z2h-pm 세션이 이미 있음: tmux attach -t z2h-pm"; exit 1; fi
tmux new-session -d -s z2h-pm -x 220 -y 60 -c "$REPO" \
  "env -u CLAUDE_CODE_EFFORT_LEVEL claude --model claude-fable-5-2 --effort medium --settings ./.claude/z2h-run.settings.json"
echo "z2h-pm 시작됨. 붙기: tmux attach -t z2h-pm"
echo "첫 화면 확인: Fable 5.2 with medium effort, 크레딧 동의 창 없음. 그다음 docs/PM_KICKOFF.md 내용을 붙여넣기."
