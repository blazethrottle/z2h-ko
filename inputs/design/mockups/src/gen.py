# Z2H 목업 HTML 생성기. 공통 머리·탭을 붙여 screen별 HTML을 만든다.
import pathlib
OUT = pathlib.Path(__file__).parent
NAV = [("home","홈","⌂"),("lectures","강의","≡"),("review","복습","↻"),("basics","기초","◇")]
def page(name, title, body, cur="home", back=None, wide=False):
    nav = "".join(f'<a href="#" {"aria-current=page" if k==cur else ""}>{t}</a>' for k,t,_ in NAV)
    tabs = "".join(f'<a href="#" {"aria-current=page" if k==cur else ""}><span class="ico" aria-hidden="true">{i}</span>{t}</a>' for k,t,i in NAV)
    bk = f'<a class="back" href="#" aria-label="{back}">‹</a>' if back else ""
    return icons(f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><link rel="stylesheet" href="z2h.css"><link rel="stylesheet" href="z2h_v2.css"><style>{EXTRA.get(name,"")}</style></head><body>
<header class="topbar">{bk}<span class="brand">Z2H<small>제로 투 히어로 실습</small></span><nav class="topnav" aria-label="주 메뉴">{nav}</nav><span class="sync" role="status" aria-label="진도 저장됨">✓ 저장됨</span><span class="sample">예시 화면</span></header>
<main class="{'wide' if wide else ''}">{body}</main>
<nav class="tabbar" aria-label="주 메뉴">{tabs}</nav></body></html>''')
EXTRA = {}
def _svg(path,w=1.0):
    return f'<svg class="ic" width="{w}em" height="{w}em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg>'
ICONS={"✕":_svg('<path d="M6 6l12 12M18 6L6 18"/>'),"✓":_svg('<path d="M4.5 12.5l5 5L19.5 7"/>'),
 "▾":_svg('<path d="M6 9l6 6 6-6"/>',0.9),"▴":_svg('<path d="M6 15l6-6 6 6"/>',0.9),
 "⧉":_svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',1.0),
 "⌂":_svg('<path d="M4 11l8-7 8 7v9H4z"/>'),"≡":_svg('<path d="M4 6h16M4 12h16M4 18h16"/>')}
def icons(h):
    for k,v in ICONS.items(): h=h.replace(k,v)
    return h

def player(state="ready", collapsed=False, compact=False, rng="19:09–32:10", note=False):
    st0,en0 = (rng.split("–")+[""])[:2]
    btn = '<button class="btn sm ghost" aria-expanded="false" aria-controls="pl">펼치기 ▾</button>' if collapsed else '<button class="btn sm ghost" aria-expanded="true" aria-controls="pl">접기 ▴</button>'
    head = f'<div class="pc-head"><div><h2>영상 <span class="num">{rng}</span></h2><span class="cap num">유튜브 공식 챕터 기준</span></div>{btn}</div>'
    if state=="ready":
        body = f'<span class="lbl">YouTube 플레이어 자리 (목업)</span><button class="playbtn" aria-label="영상 재생, {st0}부터">▶</button><span class="sub">누르면 {st0}부터 재생 · 한국어 자막 켜짐 · 자동 재생 없음</span><span class="range"><span>{st0}</span><i></i><span>{en0}에 멈춤</span></span>'
    elif state=="loading":
        body = '<span class="msg" role="status">영상을 불러오는 중입니다</span><span class="sk2"></span><span class="sub">오래 걸리면 아래 유튜브에서 열기를 쓰세요</span>'
    elif state=="pending":
        body = '<span class="msg">구간 준비 중</span><span class="sub">이 단계의 영상 시각을 아직 정하지 못했습니다. 영상 처음부터 열 수 있습니다.</span><a class="btn primary sm" href="#">유튜브에서 영상 열기 ↗</a>'
    else:
        body = f'<span class="msg" role="alert">✕ 이 화면에서 영상을 열 수 없습니다</span><span class="sub">인터넷 연결이나 유튜브 설정 때문일 수 있습니다</span><a class="btn primary sm" href="#">유튜브에서 {st0}부터 보기 ↗</a>'
    foot = f'<div class="pc-foot"><a href="#" aria-label="유튜브에서 {st0}부터 열기, 새 창">유튜브에서 열기 ↗</a><span class="cap">{en0}에서 멈춥니다</span></div>'
    if state in ("error","pending"): foot=''
    if note and state=="ready": foot += '<p class="pc-note cap">자막: 한국어 자막(YouTube 자동 번역)을 켜서 엽니다. YouTube가 한국어 자막을 주지 않으면 영어 자막이나 자막 없이 재생됩니다. 그때는 아래 세 줄 요약과 핵심 개념으로 내용을 확인하세요.</p>'
    return f'<section class="pcard{" collapsed" if collapsed else ""}" aria-label="영상 구간 {rng}">{head}<div class="player {state}" id="pl">{body}</div>{foot}</section>'

LECT = [("01","micrograd","2:26"),("02","makemore","1:58"),("03","makemore MLP","1:16"),("04","Activations·BatchNorm","1:56"),("05","Backprop Ninja","1:55"),("06","WaveNet","0:56"),("07","Let's build GPT","1:56"),("08","State of GPT (강연)","0:43"),("09","GPT Tokenizer","2:14"),("10","Reproduce GPT-2 124M","4:01")]

# ---------- 1 홈·진도 ----------
STEPS={"01":26,"02":16,"03":12,"04":18,"05":13,"06":12,"07":23,"08":8,"09":13,"10":28}
EXTRA["s1_home"] = """
.home{display:grid;gap:var(--s5)}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)}
.stat{padding:var(--s4)}
.lec{display:flex;align-items:center;gap:var(--s3);min-height:56px;padding:var(--s2) 0;border-top:1px solid var(--line)}
.lec:first-child{border-top:0}
.lec .no{width:2.2em;font-weight:700;color:var(--ink-muted);font-variant-numeric:tabular-nums}
.lec .nm{flex:1;font-weight:600}
.lec .nm small{display:block;font-weight:400;font-size:13px;color:var(--ink-muted)}
.lec .meta{font-size:13px;color:var(--ink-muted);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.lec.on .no{color:var(--accent)}
.cp{font-size:13px;color:var(--ink-muted);padding:6px 0 6px 2.2em;border-top:1px dashed var(--line)}
@media(max-width:1023px){.home>div{display:contents}.home>div>*{margin-top:0!important}.home [aria-labelledby=cont]{order:1}.home [aria-labelledby=st]{order:2}.home [aria-labelledby=rv]{order:3}.home [aria-labelledby=lecs]{order:4}.home [aria-labelledby=bs]{order:5}}
@media(min-width:1024px){.home{grid-template-columns:1.5fr 1fr;align-items:start}.stats{grid-template-columns:1fr 1fr}}
"""
lec_rows = ""
CPS={"03":"누적 점검 1 (01~03편) · 통과하면 04편이 열립니다","06":"누적 점검 2 (01~06편) · 통과하면 07편이 열립니다","10":"누적 점검 3 (01~10편) · 통과하면 수료"}
for i,(n,nm,d) in enumerate(LECT):
    sub = '<small>축소판 실습</small>' if n=="10" else ('<small>강연 · 보기와 정리 카드</small>' if n=="08" else "")
    if i==0: st=f'<span class="badge cur">진행 중</span><br><span class="num">3 / {STEPS[n]} 단계</span>'; cls="lec on"
    else: st=f'<span class="num">0 / {STEPS[n]} 단계</span><br>영상 <span class="num">{d}</span>'; cls="lec"
    lec_rows += f'<a href="#" class="{cls}" style="text-decoration:none;color:inherit"><span class="no">{n}</span><span class="nm">{nm}{sub}</span><span class="meta">{st}</span></a>'
    if n in CPS: lec_rows += f'<div class="cp">{CPS[n]}</div>'
s1 = f'''<div class="home">
<div class="stack">
 <p class="cap">11월 16일 (월) · 예시</p>
 <section class="card current stack" aria-labelledby="cont">
  <p class="kicker">이어서 하기</p>
  <h1 id="cont" class="t1">01 micrograd</h1>
  <p class="num"><b>단계 4 / 26</b> · Value 클래스 뼈대 <span class="cap">L01-S04</span></p>
  <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="26" aria-valuenow="3" aria-label="01 micrograd 진도 26단계 중 3단계 완료"><i style="width:11.5%"></i></div>
  <p class="small muted">이 단계: 영상 구간 보기 → 코드 8줄 입력 → 결과 비교</p>
  <a class="btn primary block" href="#">단계 4 이어서 하기</a>
  <div class="next small"><b>다음:</b><span>단계 5 · 덧셈과 곱셈 기록하기</span></div>
 </section>
 <section class="card" aria-labelledby="lecs">
  <div class="row"><h2 id="lecs" class="t3">강의 10편 · 169단계</h2><span class="sp"></span><span class="cap num">영상 합계 약 19.6시간</span></div>
  <div style="margin-top:var(--s2)">{lec_rows}</div>
 </section>
</div>
<div class="stack">
 <section aria-labelledby="st" class="stack">
  <h2 id="st" class="t3">내 진도</h2>
  <div class="stats">
   <div class="card stat"><p class="cap">완료 단계</p><p class="big">3</p><p class="delta">▲+3 이번 주</p></div>
   <div class="card stat"><div class="row" style="gap:4px"><p class="cap">이번 주 실습 시간 (시:분)</p><span class="sp"></span><button class="btn ghost sm edit" aria-label="이번 주 실습 시간 수정">수정</button></div><p class="big">2:40</p><p class="delta"><span class="badge">수정됨</span> 자동 2:25</p></div>
  </div>
  <p class="cap">실습 시간은 화면이 열려 있고 사용 중일 때만 자동으로 셉니다. 틀리면 직접 고칠 수 있고, 고친 값에는 수정됨이 붙습니다.</p>
 </section>
 <section class="card stack" aria-labelledby="rv">
  <div class="row"><h2 id="rv" class="t3">오늘 복습</h2><span class="sp"></span><span class="badge num">5장 · 약 12분</span></div>
  <p class="small muted">하루 복습은 25분을 넘지 않게 맞춥니다.</p>
  <a class="btn block" href="#">복습 시작</a>
 </section>
 <section class="card stack" aria-labelledby="bs">
  <p class="kicker">강의 전에 권장</p>
  <h2 id="bs" class="t3">사전 기초: 파이썬 9단위 · 수학 6단위</h2>
  <p class="small muted num">2 / 15 단위 완료 · 01편에 필요한 단위: F-P1·P2·P5·P6·P7, F-M1·M2·M6</p>
  <a class="btn block" href="#">기초 이어서 보기</a>
 </section>
</div></div>'''
(OUT/"s1_home.html").write_text(page("s1_home","홈·진도",s1,"home",wide=True))

# ---------- 2 강의 개요 ----------
L01=[('S01', '함수 그래프 그리기', '신경망도 결국 입력을 넣으면 출력이 나오는 큰 함수입니다. 오늘은 이런 함수의 "기울기"를 직접 재고 계산합니다.', True, False, False), ('S02', '숫자 기울기', 'x를 아주 조금 올리면 f는 그 약 14배만큼 오릅니다. 기울기는 "조금 바꾸면 몇 배로 변하나"입니다.', False, False, False), ('S03', '입력이 여러 개일 때', 'd를 a로 미분하면 b가 나옵니다. `a += h`를 `b += h`로 바꾸면 2.0(a의 값), `c += h`로 바꾸면 1.0이 나오는지 직접 해 봅니다.', True, False, False), ('S04', 'Value 클래스 뼈대', '평범한 숫자에 "기울기 칸"과 "족보(재료 기록)"를 붙였습니다. 이 두 칸이 역전파의 전부입니다.', True, False, False), ('S05', '덧셈과 곱셈 기록하기', '계산할 때마다 "누가 누구로 만들어졌는지"가 그물(계산 그래프)로 남습니다.', True, False, True), ('S06', '계산 그래프 그림', '역전파는 이 그림을 오른쪽(결과)에서 왼쪽(재료)으로 거슬러 가는 일입니다.', True, True, False), ('S07', '손으로 기울기 채우기', '+ 는 기울기를 그대로 나눠 주고, * 는 상대 값을 곱해 전합니다. 결과에서 거꾸로 곱해 오는 것이 연쇄 법칙입니다.', True, False, False), ('S08', '한 걸음 움직여 보기', '기울기는 "어느 쪽으로 움직이면 결과가 커지는지" 알려 줍니다. 학습은 이것을 반대로(손실을 줄이는 쪽으로) 쓰는 일입니다.', True, False, False), ('S09', '뉴런 하나 계산하기', '뉴런은 "입력 × 가중치의 합 + 편향"입니다. 여기까지는 S05에서 만든 +와 *만 씁니다.', True, False, False), ('S09b', 'tanh 붙이기', '뉴런의 출력은 합에 tanh를 씌운 값입니다. 이 활성화 함수 덕분에 신경망이 곡선 모양도 배울 수 있습니다.', True, False, True), ('S10', '_backward를 + 와 * 안에 넣기', 'S07에서 손으로 한 규칙을 각 계산 안에 넣어, 결과 상자가 "내 기울기를 재료에게 어떻게 나눌지"를 스스로 알게 했습니다.', True, False, True), ('S10b', 'tanh의 _backward', '각 상자가 자기 _backward를 부르면 기울기가 한 칸씩 왼쪽으로 갑니다. 이것을 모든 상자에 순서대로 하면 역전파입니다.', True, False, True), ('S11', '위상 정렬', '재료가 늘 결과보다 앞에 섭니다. 이 목록을 거꾸로 돌면, 결과 쪽 기울기가 다 모인 뒤에 재료로 넘어갑니다.', True, False, False), ('S11b', 'backward() 메서드', '손으로 하던 역전파가 `o.backward()` 한 줄이 되었습니다. PyTorch의 `loss.backward()`도 같은 일을 합니다.', True, False, True), ('S12', '같은 값을 두 번 쓰는 버그', 'a에서 b로 가는 길이 두 개라 기울기 1이 두 번 와서 2가 됩니다. S10에서 `=`가 아니라 `+=`로 쌓았기 때문입니다. (해 보기: `__add__`의 `+=`를 `=`로 바꾸면 1.0이 나오는 것을 확인하고 다시 되돌립니다.)', False, False, False), ('S13', '숫자와 섞어 계산하기', '이제 `a + 1`, `1 + a`, `2 * a`처럼 평범한 숫자를 섞어 쓸 수 있습니다. S15의 `sum(...)`이 0부터 더하기 때문에 `__radd__`가 꼭 필요합니다.', True, False, True), ('S13b', 'exp와 빼기', '빼기는 새 규칙 없이 "더하기 + 부호 바꾸기"로 만들었습니다. 이미 만든 연산을 조합하면 기울기도 저절로 맞습니다.', True, False, True), ('S13c', '거듭제곱과 나누기', '나누기도 "곱하기 + 거듭제곱"으로 만들었습니다. S15의 손실 `(yout - ygt)**2`가 이 단계의 빼기와 거듭제곱을 씁니다.', True, False, True), ('S13d', 'tanh를 쪼개서 다시 계산하기', '같은 계산을 큰 덩어리(tanh) 하나로 하든 작은 연산 여러 개로 쪼개든 기울기는 같습니다. 덩어리를 얼마나 크게 둘지는 만드는 사람이 정합니다.', False, False, False), ('S13e', 'PyTorch로 비교', '우리가 만든 micrograd와 PyTorch는 같은 역전파를 합니다. PyTorch는 숫자 하나 대신 텐서(숫자 묶음)로 빠르게 할 뿐입니다.', True, False, False), ('S14', 'Neuron 클래스', 'S09에서 손으로 만든 뉴런을 설계도로 만들었습니다. 가중치는 무작위로 시작해 학습으로 고쳐집니다.', True, False, False), ('S14b', 'Layer 클래스', '층은 같은 입력을 여러 뉴런이 동시에 보는 것입니다.', True, False, False), ('S14c', 'MLP 클래스와 parameters()', '신경망은 층을 이은 것이고, 학습이란 이 41개 숫자를 조금씩 고치는 일입니다.', True, False, False), ('S15', '데이터와 손실', '손실은 "얼마나 틀렸나"를 숫자 하나로 모은 것입니다. 0이면 다 맞힌 것입니다.', True, False, False), ('S15b', '학습 반복', '이것이 신경망 학습의 전부입니다: 예측하고, 틀린 정도를 재고, 기울기를 구해, 반대로 조금 움직이기. 큰 AI도 같은 반복을 아주 크게 할 뿐입니다.', True, False, False), ('S16', 'grad 비우기를 빼먹는 버그', '기울기는 `+=`로 쌓이므로, 반복마다 비우지 않으면 지난 반복의 기울기가 섞여 걸음이 엉뚱하게 커집니다. Karpathy도 영상에서 이 실수를 했고, 문제가 쉬워서 우연히 잘 된 것처럼 보였다고 직접 말합니다.', False, False, True)]
CH=[t for _,t,_,_,_,_ in L01]
SUM=[m for _,_,m,_,_,_ in L01]
EXTRA["s2_lecture"] = """
.ch{display:flex;gap:var(--s3);padding:var(--s3) var(--s4);border-top:1px solid var(--line);min-height:64px;align-items:flex-start;text-decoration:none;color:inherit}
.ch:first-child{border-top:0}
.ch .no{width:2em;flex:none;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink-muted);padding-top:1px}
.ch .bd{flex:1}
.ch .nm{font-weight:600}
.ch .st{flex:none;font-size:13px;font-weight:600;white-space:nowrap;padding-top:3px}
.ch.done .st{color:var(--correct)}
.ch.now{background:var(--accent-tint);border-left:3px solid var(--accent)}
.ch.now .no,.ch.now .st{color:var(--accent)}
.ch.todo .st{color:var(--ink-muted)}
.list{padding:0;overflow:hidden}
.ch .tg{display:inline-block;margin-left:6px;font-size:13px;font-weight:600;color:var(--ink-muted);border:1px solid var(--line-strong);border-radius:var(--r-pill);padding:0 8px;vertical-align:1px}
.ch .no{width:2.4em}
"""
rows=""
for i,(sid,c,s,lg,prep,ed) in enumerate(L01,1):
    cls,st = ("done","✓ 완료") if i<4 else (("now","● 지금") if i==4 else ("todo","○ 아직"))
    tags=('<span class="tg">긴 단계</span>' if lg else '')+('<span class="tg">준비 코드</span>' if prep else '')+('<span class="tg">앞 셀 고침</span>' if ed else '')
    rows+=f'<a href="#" class="ch {cls}"><span class="no">{sid[1:]}</span><span class="bd"><span class="nm">{c}</span>{tags}<br><span class="small muted">{s}</span></span><span class="st">{st}</span></a>'
s2=f'''<div class="stack">
<p class="cap">강의 01 · 영상 <span class="num">2:26</span> · 학습 예상 8~12시간</p>
<h1 class="t1">micrograd: 신경망과 역전파를 손으로 만들기</h1>
<p class="muted">숫자 하나를 담는 상자부터 시작해, 작은 신경망이 스스로 맞혀 가게 만드는 데까지 갑니다.</p>
<div class="row" style="flex-wrap:wrap"><span class="badge num">26단계</span><span class="badge num">긴 단계 22</span><span class="badge num">확인 문제 11개</span><span class="badge num">재구성 과제 3조각</span><span class="badge ok num">✓ 3 완료</span></div>
<div class="bar" aria-hidden="true"><i style="width:11.5%"></i></div>
<p class="small muted">먼저 보면 좋은 기초: F-P6 클래스와 객체, F-M2 연쇄 법칙 감각 (추천)</p>
<div class="next small"><b>다음:</b><span>단계 4 · Value 클래스 뼈대</span></div>
<section class="card list" aria-label="단계 목록">{rows}</section>
<div class="card stack"><p class="t3">편 끝: 핵심 재구성 과제</p><p class="small muted">빈 노트북에서 가장 중요한 3조각을 다시 만듭니다. 각 조각은 힌트 2단계까지 쓰고 완성하면 익힘으로 칩니다.</p></div>
</div>'''
(OUT/"s2_lecture.html").write_text(page("s2_lecture","강의 개요",s2,"lectures",back="강의 목록으로"))

# ---------- 3 강의 구간 ----------
EXTRA["s3_segment"] = """
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s2);list-style:none;padding:0;margin:0}
.steps li{display:flex;flex-direction:column;gap:2px;padding:var(--s2) var(--s3);border-radius:var(--r-md);border:1px solid var(--line);background:var(--paper-raised);font-size:13px;font-weight:600;color:var(--ink-muted)}
.steps li b{font-size:15px;color:var(--ink)}
.steps li[aria-current]{border:2px solid var(--accent);color:var(--accent)}
.sum{margin:0;padding-left:1.4em}
.sum li+li{margin-top:var(--s2)}
.term{display:grid;grid-template-columns:auto 1fr;gap:var(--s1) var(--s4);align-items:baseline}
.term dt{font-family:var(--font-code);font-weight:600;font-size:14px;background:var(--paper-sunken);padding:0 8px;border-radius:var(--r-sm);font-variant-ligatures:none}
.term dd{margin:0}
.lay{display:grid;gap:var(--s6)}
.rail{display:none}
@media(min-width:1024px){.lay{grid-template-columns:1fr 300px}.rail{display:block}}
.mini a{display:flex;gap:10px;min-height:44px;align-items:center;font-size:14px;color:var(--ink);text-decoration:none;border-radius:var(--r-sm);padding:0 var(--s2)}
.mini a.now{background:var(--accent-tint);color:var(--accent);font-weight:600}
.mini a .no{font-variant-numeric:tabular-nums;color:var(--ink-muted);width:1.6em}
.mini a.done .no{color:var(--correct)}
"""
mini="".join(f'<a href="#" class="{"done" if i<4 else ("now" if i==4 else "")}"><span class="no">{"✓" if i<4 else L01[i-1][0][1:]}</span>{c}</a>' for i,c in enumerate(CH,1))
s3=f'''<div class="lay"><div class="stack">
<p class="cap">01 micrograd · <span class="num">단계 4 / 26</span> · L01-S04</p>
<h1 class="t1">Value 클래스 뼈대</h1>
{player(note=True)}
<p class="cap">이 영상 구간(유튜브 공식 챕터 19:09–32:10)은 단계 4~6이 함께 씁니다.</p>
<p><b>이 단계에서 하는 일:</b> 숫자 하나에 기울기 칸과 재료 기록을 붙인 상자(Value)를 만듭니다.</p>
<ol class="steps" aria-label="이 단계의 순서"><li aria-current="step">1 · 지금<b>영상 보기</b></li><li>2<b>따라 하기</b></li><li>3<b>결과 비교</b></li></ol>
<section class="card stack" aria-labelledby="sm">
 <h2 id="sm" class="t3">세 줄 요약 (예시)</h2>
 <ol class="sum"><li>신경망 계산은 숫자를 많이 더하고 곱하는 일입니다.</li><li>각 숫자가 결과에 얼마나 영향을 주는지(기울기)를 알아야 학습할 수 있습니다.</li><li>그래서 숫자와 기울기, 재료 기록을 한 상자에 담는 Value를 먼저 만듭니다.</li></ol>
</section>
<section class="card stack" aria-labelledby="kc">
 <h2 id="kc" class="t3">이 단계의 새 개념 1개</h2>
 <dl class="term"><dt>Value</dt><dd>숫자 하나를 감싸는 상자. data(실제 숫자), grad(기울기, 처음엔 0), _prev(나를 만든 재료), _op(어떤 계산으로 만들어졌는지)를 가집니다.</dd></dl>
 <p class="cap">익힘 판정 뒤 복습 카드로 다시 나옵니다.</p>
</section>
<a class="btn primary block" href="#">따라 하기 시작</a>
<div class="next small"><b>다음:</b><span>따라 하기 · 코드 8줄로 Value 만들기</span></div>
</div>
<aside class="rail"><div class="card"><p class="cap" style="margin-bottom:var(--s2)">01 micrograd · 16단계</p><nav class="mini" aria-label="단계 목록">{mini}</nav></div></aside>
</div>'''
(OUT/"s3_segment.html").write_text(page("s3_segment","강의 구간",s3,"lectures",back="강의 개요로",wide=True))

# ---------- 4 따라 하기 실습 ----------
CODE = [
 ('<span class="k">class</span> Value:', "숫자 하나를 감싸는 상자(Value)의 설계도를 만듭니다."),
 ('    <span class="k">def</span> __init__(self, data, _children=(), _op=<span class="s">\'\'</span>):', "상자를 새로 만들 때 한 번 실행되는 준비 동작입니다. 숫자, 재료, 계산 기호를 받습니다."),
 ('        self.data = data', "실제 숫자를 data 칸에 넣습니다."),
 ('        self.grad = <span class="n">0.0</span>', "기울기 칸입니다. 처음엔 0이고, 나중 단계에서 역전파가 채웁니다."),
 ('        self._prev = set(_children)', "나를 만든 재료 값들을 기록합니다."),
 ('        self._op = _op', "어떤 계산(+, *)으로 만들어졌는지 기록합니다."),
 ('    <span class="k">def</span> __repr__(self):', "상자를 화면에 보여 줄 때의 모양을 정합니다."),
 ('        <span class="k">return</span> <span class="s">f"Value(data={self.data})"</span>', "Value(data=숫자) 모양으로 보여 줍니다."),
]
EXTRA["s4_practice"] = """
.lay{display:grid;gap:var(--s5)}
.cells{display:grid;gap:var(--s2);list-style:none;padding:0;margin:0}
.cells li{display:flex;gap:var(--s3);align-items:flex-start;padding:var(--s3) var(--s4);border:1px solid var(--line);border-radius:var(--r-md);background:var(--paper-raised)}
.cells li .n{flex:none;width:28px;height:28px;border-radius:50%;background:var(--paper-sunken);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}
.cells li[aria-current] {border:2px solid var(--accent)}
.cells li[aria-current] .n{background:var(--accent);color:var(--on-accent)}
.cells li b{display:block}
.where{display:grid;gap:var(--s3)}
.where .chips{display:flex;gap:var(--s2);flex-wrap:wrap}
.cx{border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--line)}
.cx-top{display:flex;align-items:center;gap:var(--s3);padding:var(--s2) var(--s2) var(--s2) var(--s4);background:var(--code-bg);color:var(--code-comment);font-size:13px;font-family:var(--font-ui);border-bottom:1px solid #2A3350}
.cx-top .btn{background:transparent;color:var(--code-text);border-color:#4A5470}
.line{display:block;border-top:1px solid #262C3E}
.line .cd{display:flex;align-items:flex-start;min-height:44px;padding:10px var(--s4) 10px 0;background:var(--code-bg);color:var(--code-text);font-family:var(--font-code);font-size:13.5px;line-height:1.7;white-space:pre;overflow-x:auto;font-variant-ligatures:none;cursor:pointer}
.line .ex{display:none;padding:var(--s3) var(--s4) var(--s3) calc(2.2em + 1em + 16px);background:var(--accent-tint);color:var(--ink);font-size:15px;line-height:1.65;border-left:3px solid var(--accent)}
.line.open .cd{background:var(--code-bg-sel)}
.line.open .cd .ln{color:var(--code-text)}
.line.open .ex{display:block}
.line .tog{margin-left:auto;padding-left:var(--s3);color:var(--code-comment);font-family:var(--font-ui);font-size:13px;white-space:nowrap}
.panel{display:grid;gap:var(--s4)}
.pred{display:flex;gap:var(--s2);align-items:baseline;font-size:14px}
@media(min-width:1024px){
 .lay{grid-template-columns:1fr 340px;align-items:start}
 .cells{grid-template-columns:repeat(3,1fr)}
 .line{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);border-top:0}
 .line .cd{border-top:1px solid #262C3E;cursor:default;min-height:48px;align-items:flex-start;padding-top:12px;white-space:pre-wrap;overflow-wrap:anywhere}
 .line .ex{display:block;background:var(--paper-raised);border-left:0;border-top:1px solid var(--line);padding:12px var(--s5);font-size:15px}
 .line.open .ex{background:var(--accent-tint);box-shadow:inset 3px 0 0 var(--accent)}
 .line .tog{display:none}
 .cx-cols{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
 .cx-cols span{padding:var(--s2) var(--s4);font-size:13px;font-weight:600}
 .cx-cols .a{background:var(--code-bg);color:var(--code-comment)}
 .cx-cols .b{background:var(--paper-sunken);color:var(--ink-muted)}
}
.pl-d{display:none}
@media(min-width:1024px){.pl-m{display:none}.pl-d{display:block}.pl-d .player .playbtn{width:48px;height:48px}.pl-d .player .sub{display:none}}
@media(max-width:1023px){.cx-cols{display:none}.line .cd{white-space:pre-wrap;overflow-wrap:anywhere}}
"""
lines=""
for i,(c,e) in enumerate(CODE,1):
    cls = "line open" if i==4 else "line"
    tog = "풀이 접기 ▴" if i==4 else "풀이 ▾"
    aria = f' role="button" aria-expanded="{"true" if i==4 else "false"}" aria-controls="ex{i}" tabindex="0"'
    lines += f'<div class="{cls}"><div class="cd"{aria}><span class="ln">{i}</span><span>{c}</span><span class="tog">{tog}</span></div><div class="ex" id="ex{i}">{e}</div></div>'
s4=f'''<div class="stack">
<p class="cap">01 micrograd · <span class="num">단계 4 / 26</span> · L01-S04 · 따라 하기</p>
<h1 class="t1">Value 클래스 뼈대 <span class="badge">긴 단계</span></h1>
<ol class="cells" aria-label="이 단계의 세 칸">
 <li aria-current="step"><span class="n">1</span><div><b>입력할 것</b><span class="small">아래 코드 8줄을 노트북 단계 4 칸에 붙여 넣고 실행합니다. 이어서 <code>Value(2.0)</code>을 실행합니다.</span></div></li>
 <li><span class="n">2</span><div><b>보여야 하는 것</b><span class="small"><code>Value(data=2.0)</code></span></div></li>
 <li><span class="n">3</span><div><b>그 뜻</b><span class="small">숫자에 기울기 칸과 족보(재료 기록)를 붙였습니다.</span></div></li>
</ol>
</div>
<div class="lay" style="margin-top:var(--s5)"><div class="stack">
<div class="pl-m">{player(collapsed=True)}</div>
<section class="card where" aria-labelledby="wh">
 <h2 id="wh" class="t3">어디서 실행하나요</h2>
 <div class="chips" role="group" aria-label="실행 장소"><button class="chip" aria-pressed="true">Google Colab</button><button class="chip" aria-pressed="false">맥미니 Jupyter</button></div>
 <p class="small">Colab 노트북 <b>L01_micrograd.ipynb</b>를 열고 <b>L01-S04</b> 칸에 붙여 넣은 뒤 ▶ 실행(또는 Shift+Enter)을 누르세요.</p>
 <a class="btn sm" href="#">Colab에서 노트북 열기 ↗</a>
</section>
<section class="cx" aria-labelledby="cd">
 <div class="cx-top"><span id="cd">1 · 입력할 것: 코드 8줄 · 줄을 누르면 풀이</span><span class="sp"></span><button class="btn sm" aria-label="코드 8줄 전체 복사" style="white-space:nowrap">⧉ 복사</button></div>
 <div class="cx-cols" aria-hidden="true"><span class="a">코드</span><span class="b">한국어 풀이</span></div>
 {lines}
</section>
<section class="card stack" aria-labelledby="eo">
 <h2 id="eo" class="t3">2 · 보여야 하는 것</h2>
 <p class="pred"><span class="badge">내 예측</span><span>Value(data=2)</span><span class="cap">실행 전에 적어 둔 것</span></p>
 <pre class="out" style="margin:0">Value(data=2.0)</pre>
 <label for="mine" class="small" style="font-weight:600">내 결과 붙여넣기</label>
 <textarea id="mine" rows="2">Value(data=2)</textarea>
 <button class="btn primary block">비교하기</button>
 <div class="result ng" role="status"><span class="sym" aria-hidden="true">✕</span><div><b>다시</b><p>숫자 모양이 다릅니다. 예상은 <code>2.0</code>, 내 결과는 <code>2</code>입니다. <code>Value(2.0)</code>처럼 소수점을 붙였는지 확인해 보세요.</p></div></div>
</section>
<section class="card stack" aria-labelledby="mn"><h2 id="mn" class="t3">3 · 그 뜻</h2><p>숫자에 기울기 칸과 족보(재료 기록)를 붙였습니다. 다음 단계에서 덧셈과 곱셈이 이 족보를 채웁니다.</p></section>
</div>
<aside class="panel">
 <div class="pl-d">{player(compact=True)}</div>
 <section class="card stack" aria-labelledby="hn">
  <h2 id="hn" class="t3">막혔나요?</h2>
  <p class="small muted">힌트는 4단계입니다. 실습 단계는 점수가 없어서 힌트를 열어도 완료로 셉니다.</p>
  <button class="btn block">1단계 힌트 열기</button>
  <p class="cap num">이 단계 힌트 사용: 0 / 4</p>
 </section>
 <section class="card stack">
  <p class="cap num">단계 4 / 26 · 01 micrograd</p>
  <div class="bar" aria-hidden="true"><i style="width:15.4%"></i></div>
  <div class="next small"><b>다음:</b><span>단계 5 · 덧셈과 곱셈 기록하기</span></div>
  <div class="row"><a class="btn" href="#">이전</a><a class="btn primary" style="flex:1" href="#">단계 4 마치기</a></div>
 </section>
</aside></div>'''
(OUT/"s4_practice.html").write_text(page("s4_practice","따라 하기 실습",s4,"lectures",back="강의 구간으로",wide=True))

# ---------- 5 확인 문제 ----------
EXTRA["s5_quiz"] = """
.qs{display:grid;gap:var(--s5)}
@media(min-width:1024px){.qs{grid-template-columns:1fr 1fr;align-items:start}}
.rub{list-style:none;padding:0;margin:0;display:grid;gap:var(--s2)}
.rub label{display:flex;gap:var(--s3);align-items:flex-start;min-height:44px;padding:var(--s2) var(--s3);border:1px solid var(--line-strong);border-radius:var(--r-md);background:var(--paper-raised)}
.rub input{width:22px;height:22px;margin:2px 0 0;accent-color:var(--accent);flex:none}
.rub .pt{margin-left:auto;font-size:13px;color:var(--ink-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.score{display:flex;gap:var(--s2);align-items:center;font-size:14px;font-variant-numeric:tabular-nums}
.typ{display:flex;gap:var(--s2);flex-wrap:wrap}
textarea.long{font-family:var(--font-ui);font-size:16px;min-height:120px}
.opts{display:grid;gap:var(--s2);list-style:none;padding:0;margin:0}
.opt{display:flex;gap:var(--s3);align-items:center;min-height:52px;padding:var(--s2) var(--s4);border:1px solid var(--line-strong);border-radius:var(--r-md);background:var(--paper-raised);width:100%;text-align:left;font:inherit;color:inherit}
.opt .mk{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.opt.sel{border:2px solid var(--accent);background:var(--accent-tint)}
.opt.sel .mk{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
.opt .tag{margin-left:auto;font-size:13px;font-weight:700;color:var(--accent)}
@media(min-width:1024px){.qs{grid-template-columns:repeat(3,1fr)}}
"""
s5='''<div class="stack">
<p class="cap">01 micrograd · 확인 문제 · 단계 1~7 범위 · 5유형 중 3개 예시</p>
<h1 class="t1">확인 문제</h1>
<p class="muted small">답을 내면 풀이가 열립니다. 틀린 문제는 복습 카드로 다시 나옵니다.</p>
</div>
<div class="qs" style="margin-top:var(--s5)">
<section class="card stack" aria-labelledby="q0">
 <div class="typ"><span class="badge cur">고르기</span><span class="cap">확인 문제 · type: choice · 예시 문항</span></div>
 <h2 id="q0" class="t3">f(x) = 3x² - 4x + 5 에서 x = 2/3 의 숫자 기울기는 대략 얼마일까요?</h2>
 <ul class="opts" role="radiogroup" aria-labelledby="q0">
  <li><button class="opt sel" role="radio" aria-checked="true"><span class="mk">1</span><span>약 0</span><span class="tag">고름</span></button></li>
  <li><button class="opt" role="radio" aria-checked="false"><span class="mk">2</span><span>약 14</span></button></li>
  <li><button class="opt" role="radio" aria-checked="false"><span class="mk">3</span><span>약 -4</span></button></li>
  <li><button class="opt" role="radio" aria-checked="false"><span class="mk">4</span><span>약 5</span></button></li>
  <li><button class="opt" role="radio" aria-checked="false"><span class="mk">5</span><span>모르겠어요</span></button></li>
 </ul>
 <button class="btn block">제출</button>
 <div class="result ok" role="status"><span class="sym" aria-hidden="true">✓</span><div><b>맞음</b><p>x = 2/3은 포물선의 가장 낮은 점이라 조금 움직여도 f가 거의 변하지 않습니다. 그래서 기울기가 0에 가깝습니다.</p></div></div>
 <p class="cap">고른 뒤 "제출"을 눌러야 채점됩니다. "모르겠어요"는 감점 없이 기록만 하고 복습 추천에 씁니다.</p>
</section>
<section class="card stack" aria-labelledby="q1">
 <div class="typ"><span class="badge cur">결과 예측</span><span class="cap">L01-Q03 · 정확히 맞추기</span></div>
 <h2 id="q1" class="t3"><code>d = a*b + c</code>, a=2, b=-3, c=10일 때 d에 대한 <code>b.grad</code>는?</h2>
 <label for="a1" class="small" style="font-weight:600">내 답</label>
 <input id="a1" type="text" value="2.0">
 <button class="btn block">제출</button>
 <div class="result ok" role="status"><span class="sym" aria-hidden="true">✓</span><div><b>맞음</b><p>정답 2.0. d를 b로 미분하면 b와 곱해진 상대 값 a가 남습니다.</p></div></div>
 <p class="score"><span class="badge">점수</span>1 / 1 · 힌트 없이</p>
 <p class="cap">결과 예측 문제에는 힌트가 없습니다.</p>
</section>
<section class="card stack" aria-labelledby="q2">
 <div class="typ"><span class="badge cur">내 말로 설명</span><span class="cap">L01-Q04 · 채점 기준으로 확인</span></div>
 <h2 id="q2" class="t3">+ 노드와 * 노드가 기울기를 전하는 방식은 어떻게 다른가요?</h2>
 <label for="a2" class="small" style="font-weight:600">내 설명</label>
 <textarea id="a2" class="long">더하기는 받은 기울기를 그대로 재료에게 넘겨 준다. 곱하기는 잘 모르겠다.</textarea>
 <p class="cap num">글자 수 제한 없음 · 제출 뒤 채점 기준이 열립니다</p>
 <button class="btn block">제출</button>
 <div class="stack" role="group" aria-labelledby="rb"><p id="rb" class="small" style="font-weight:600">채점 기준: 내 설명에 들어 있는 것을 고르세요</p>
 <ul class="rub">
  <li><label><input type="checkbox" checked><span>+는 기울기를 그대로 전한다</span><span class="pt">0.5점</span></label></li>
  <li><label><input type="checkbox"><span>*는 상대 값을 곱해서 전한다</span><span class="pt">0.5점</span></label></li>
 </ul></div>
 <div class="result part" role="status"><span class="sym" aria-hidden="true">△</span><div><b>절반 (흔들림)</b><p>모범 설명: +는 그대로 전하고, *는 상대 값을 곱해 전합니다. 곱하기 쪽은 단계 7에서 손으로 채운 값을 다시 보면 확인할 수 있습니다.</p></div></div>
 <p class="score"><span class="badge">점수</span>0.5 / 1 · 복습 카드로 다시 나옵니다</p>
</section>
</div>
<div class="stack" style="margin-top:var(--s5)">
<div class="next small"><b>다음:</b><span>L01-Q05 · tanh 노드의 기울기 (결과 예측)</span></div>
<div class="row"><a class="btn" href="#">이전 문제</a><a class="btn primary" style="flex:1" href="#">다음 문제</a></div>
</div>'''
(OUT/"s5_quiz.html").write_text(page("s5_quiz","확인 문제",s5,"lectures",back="실습으로",wide=True))

# ---------- 6 힌트 사다리 ----------
EXTRA["s6_hints"] = """
.ladder{list-style:none;margin:0;padding:0;display:grid;gap:var(--s3)}
.rung{border:1px solid var(--line);border-radius:var(--r-md);background:var(--paper-raised);padding:var(--s4)}
.rung .hd{display:flex;align-items:center;gap:var(--s3)}
.rung .st{font-size:13px;font-weight:600;color:var(--ink-muted);text-align:right}
.rung.open{border-left:3px solid var(--accent)}
.rung.open .st{color:var(--accent)}
.rung.locked{background:var(--paper)}
.rung .bd{margin-top:var(--s2)}
.rung .eff{margin-top:var(--s2);font-size:13px;color:var(--ink-muted)}
.states{display:none}
.cmp{display:grid;gap:var(--s4)}
@media(min-width:1024px){.states{display:block}.cmp{grid-template-columns:repeat(3,1fr)}}
.mini-st{font-size:14px}
.mini-st .rung{padding:var(--s3)}
"""
HINTS=[("1","질문으로 생각하기","생각할 방향을 질문 하나로 줍니다.","a가 b에 영향을 주는 길은 몇 개인가요?","이 힌트는 점수에 영향이 없습니다."),
 ("2","개념과 위치 짚기","필요한 개념과 볼 곳을 짚어 줍니다.",'두 길의 기울기를 합쳐야 합니다. 단계 12(L01-S12)와 <code>_backward</code> 안의 <code>self.grad =</code> 줄을 보세요.<br><a href="#" class="small">기초 F-M2 연쇄 법칙 감각으로 돌아가 보기 ↗</a>',"이 힌트를 열면 이 문제는 80%로 계산됩니다."),
 ("3","빈칸 코드","정답에서 핵심만 빈칸으로 둔 코드를 줍니다.",'<pre class="code" style="padding:12px 14px;margin:0;white-space:pre">self.grad ___ <span class="n">1.0</span> * out.grad</pre>',"이 힌트를 열면 이 문제는 50%로 계산되고, 다음 복습에 다시 나옵니다."),
 ("4","정답과 줄별 풀이","정답 코드 전체와 줄마다 풀이를 줍니다.",'<pre class="code" style="padding:12px 14px;margin:0 0 8px;white-space:pre">self.grad += <span class="n">1.0</span> * out.grad</pre><code>=</code>는 덮어쓰고 <code>+=</code>는 더합니다. a가 두 길로 쓰였으니 두 길의 기울기를 더해야 2.0이 됩니다.',"이 힌트를 열면 이 문제는 0%로 계산됩니다. 완료는 인정되고, 내일 비슷한 새 문제로 다시 해 볼 수 있습니다.")]
def ladder(n, mini=False, help_open=False):
    out='<ol class="ladder">'
    for i,(k,t,d,body,eff) in enumerate(HINTS,1):
        if i<=n:
            out+=f'<li class="rung open"><div class="hd"><b>{k}. {t}</b><span class="sp"></span><span class="st">열림</span></div><div class="bd">{body}</div></li>'
        elif i==n+1:
            lock = "" if i==1 else '<p class="cap" style="margin-top:4px">앞 힌트를 본 뒤 답을 한 번 더 냈습니다. 지금 열 수 있습니다.</p>'
            out+=f'<li class="rung"><div class="hd"><b>{k}. {t}</b></div><p class="small muted bd">{d}</p>{lock}<p class="eff">{eff}</p><button class="btn {"primary" if (n==0 and not mini) else ""} block" style="margin-top:var(--s3)">{k}단계 힌트 열기</button></li>'
        else:
            when = {3:"답을 한 번 더 내거나 15분 뒤", 4:"답을 한 번 더 내거나 30분 뒤", 2:"1단계를 본 뒤 답을 한 번 더 내면"}.get(i,"")
            out+=f'<li class="rung locked"><div class="hd"><b class="muted">{k}. {t}</b><span class="sp"></span><span class="st">{when} 열림</span></div></li>'
    if n==4:
        out+='<li class="rung"><div class="hd"><b>도움 요청 메모</b></div><p class="small muted bd">정답을 넣어도 결과가 다르면 대개 설치나 장치 문제입니다. 내 코드, 에러 마지막 줄, 환경을 정리한 메모를 만듭니다. 이 화면에만 저장되고 자동으로 보내지 않습니다.</p><button class="btn block" style="margin-top:var(--s3)">메모 만들기</button></li>'
    return out+'</ol>'
s6=f'''<div class="stack">
<p class="cap">01 micrograd · 확인 문제 L01-Q06 · 버그 고치기</p>
<h1 class="t1">힌트</h1>
<p class="small muted"><code>b = a + a</code>에서 a.grad가 1.0으로 나옵니다. 고칠 곳은? · 제출 결과 ✕ 다시</p>
<section class="card stack" aria-labelledby="ld"><h2 id="ld" class="t3">힌트 사다리</h2>{ladder(2)}
<p class="cap num">이 문제 힌트: 2 / 4 · 이 문제는 80%로 계산됩니다</p></section>
<div class="next small"><b>다음:</b><span>코드를 고친 뒤 답을 다시 내기</span></div>
<a class="btn primary block" href="#">문제로 돌아가 다시 답하기</a>
</div>
<section class="states" aria-labelledby="sv" style="margin-top:var(--s8)"><h2 id="sv" class="t2" style="margin-bottom:var(--s4)">상태 (명세 참고용)</h2>
<div class="cmp">
<div class="mini-st"><p class="kicker" style="margin-bottom:8px">A. 아무것도 안 엶</p>{ladder(0,True)}</div>
<div class="mini-st"><p class="kicker" style="margin-bottom:8px">B. 3단계 열림</p>{ladder(3,True)}</div>
<div class="mini-st"><p class="kicker" style="margin-bottom:8px">C. 4단계까지 열림 + 도움 요청</p>{ladder(4,True)}</div>
</div></section>'''
(OUT/"s6_hints.html").write_text(page("s6_hints","힌트 사다리",s6,"lectures",back="문제로",wide=True))

# ---------- 7 복습 ----------
EXTRA["s7_review"] = """
.q{display:grid;gap:var(--s2)}
.item{display:flex;gap:var(--s3);align-items:flex-start;padding:var(--s3) 0;border-top:1px solid var(--line);min-height:56px}
.item:first-child{border-top:0}
.item .bd{flex:1}
.flash{border:2px solid var(--accent)}
.ans{background:var(--paper-sunken);border-radius:var(--r-md);padding:var(--s3) var(--s4)}
.three{display:grid;grid-template-columns:1fr;gap:var(--s2)}
.three .btn{flex-direction:column;gap:0;min-height:56px;padding:6px var(--s3)}
.three .btn small{font-weight:500;font-size:13px;opacity:.9}
@media(min-width:420px){.three{grid-template-columns:repeat(3,1fr)}}
.lay{display:grid;gap:var(--s5)}
@media(min-width:1024px){.lay{grid-template-columns:1.2fr 1fr;align-items:start}}
.ivl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;font-variant-numeric:tabular-nums}
.ivl span{padding:2px 8px;border-radius:var(--r-sm);background:var(--paper-sunken)}
.ivl span.on{background:var(--accent-tint);color:var(--accent);font-weight:700}
"""
s7='''<div class="stack">
<h1 class="t1">복습</h1>
<p class="muted num">오늘 5장 · 약 12분 / 하루 최대 25분 · 1 / 5</p>
</div>
<div class="lay" style="margin-top:var(--s5)">
<section class="card flash stack" aria-labelledby="fc">
 <div class="row"><span class="badge">개념 카드</span><span class="cap">RC-L01-Q07-1 · 지금 간격 3일</span></div>
 <h2 id="fc" class="t2"><code>backward()</code>가 노드를 거꾸로 도는 이유를 내 말로 설명해 보세요.</h2>
 <p class="small"><span class="badge">내 설명</span> 결과부터 거꾸로 가야 기울기가 다 모여서</p>
 <div class="ans" role="region" aria-label="모범 설명"><p><b>모범 설명:</b> 결과 쪽 기울기가 다 모인 뒤에야 재료에게 나눠 줄 수 있기 때문입니다.</p></div>
 <p class="small muted">스스로 떠올린 것과 비교해 하나를 고르세요. 다음 복습 날짜만 바뀝니다.</p>
 <div class="three">
  <button class="btn">틀렸어요<small>1일 뒤 다시</small></button>
  <button class="btn">헷갈려요<small>3일 그대로</small></button>
  <button class="btn primary">기억났어요<small>7일 뒤</small></button>
 </div>
 <div class="ivl" aria-label="복습 간격"><span>1일</span>→<span class="on">3일</span>→<span>7일</span>→<span>14일</span>→<span>30일</span>→<span>졸업 뒤 60일마다</span></div>
</section>
<div class="stack">
<section class="card" aria-labelledby="tq">
 <h2 id="tq" class="t3" style="margin-bottom:var(--s2)">오늘 남은 것 · 약 10분</h2>
 <div class="q">
  <div class="item"><span class="badge">예측</span><div class="bd"><p class="small">MLP(2, [3, 1])의 파라미터 개수는?</p><p class="cap">L01 · 간격 1일 · 약 2분</p></div></div>
  <div class="item"><span class="badge ng">✕ 다시</span><div class="bd"><p class="small">+ 노드와 * 노드의 기울기 전달 차이</p><p class="cap">L01-Q04 · 어제 절반 → 1일 · 약 3분</p></div></div>
  <div class="item"><span class="badge">기초</span><div class="bd"><p class="small">F-M2 연쇄 법칙 감각</p><p class="cap">힌트 2단계가 이 단위를 가리켜 되살림 · 약 3분</p></div></div>
  <div class="item"><span class="badge">개념</span><div class="bd"><p class="small">grad를 매번 비워야 하는 이유</p><p class="cap">L01 · 간격 3일 · 약 2분</p></div></div>
 </div>
</section>
<section class="card" aria-labelledby="up">
 <h2 id="up" class="t3" style="margin-bottom:var(--s2)">다음 복습</h2>
 <p class="small num">11월 17일 (화) · 3장 · 약 8분</p><p class="small num">11월 19일 (목) · 2장 · 약 5분</p>
 <p class="cap" style="margin-top:var(--s2)">기억났어요는 다음 간격으로, 헷갈려요는 같은 간격을 한 번 더, 틀렸어요만 1일로 돌아갑니다. 25분을 넘는 날은 간격이 긴 카드를 하루 미룹니다. 빼먹은 날도 벌점은 없습니다.</p>
</section>
<div class="next small"><b>다음:</b><span>예측 · MLP(2, [3, 1])의 파라미터 개수는?</span></div>
</div></div>'''
(OUT/"s7_review.html").write_text(page("s7_review","복습",s7,"review",wide=True))

# ---------- 8 사전 기초 ----------
EXTRA["s8_basics"] = """
.mod{display:flex;gap:var(--s3);align-items:center;min-height:60px;border-top:1px solid var(--line);padding:var(--s2) 0;text-decoration:none;color:inherit}
.mod:first-child{border-top:0}
.mod .no{width:3.2em;font-weight:700;color:var(--ink-muted);font-variant-numeric:tabular-nums;font-size:14px}
.mod .bd{flex:1}
.mod .st{font-size:13px;font-weight:600;white-space:nowrap}
.mod.done .st{color:var(--correct)}
.mod.now .st,.mod.now .no{color:var(--accent)}
.mod.todo .st{color:var(--ink-muted)}
.mod.rec .st{color:var(--accent)}
.lay{display:grid;gap:var(--s5)}
@media(min-width:1024px){.lay{grid-template-columns:1fr 1fr;align-items:start}}
"""
PY=[("F-P1","실습 환경 열기와 셀 실행"),("F-P2","변수, 숫자, 글자"),("F-P3","리스트와 딕셔너리"),("F-P4","반복문과 조건문"),("F-P5","함수"),("F-P6","클래스와 객체"),("F-P7","에러 메시지 읽기"),("F-P8","numpy 배열 기초"),("F-P9","torch 텐서 기초")]
MA=[("F-M1","미분 = 기울기"),("F-M2","연쇄 법칙 감각"),("F-M3","벡터, 행렬, 행렬곱"),("F-M4","확률, softmax, log"),("F-M5","평균과 분산"),("F-M6","손실과 경사 하강")]
def mods(lst,doneN,nowI,rec=()):
    r=""
    for i,(u,t) in enumerate(lst,1):
        if i<=doneN: cls,st="done","✓ 완료"
        elif i==nowI: cls,st="now","● 지금"
        elif u in rec: cls,st="rec","추천"
        else: cls,st="todo","○ 아직"
        r+=f'<a href="#" class="mod {cls}"><span class="no">{u}</span><span class="bd"><b>{t}</b></span><span class="st">{st}</span></a>'
    return r
s8=f'''<div class="stack">
<p class="kicker">강의 전에 권장</p>
<h1 class="t1">사전 기초: 파이썬 9단위 · 수학 6단위</h1>
<p class="muted">코드를 쓰는 법이 아니라 읽는 법부터 익힙니다. 예상 8~12시간.</p>
<div class="card stack"><p class="small"><b>시작 전 진단 5문제</b> · 맞힌 결과로 어디서 시작하면 좋을지 추천합니다. 자동으로 건너뛰지 않음: 결과는 추천일 뿐이고, 강의 01은 언제든 열 수 있습니다.</p><a class="btn primary" href="#">진단 5문제 풀기</a>
<div class="result ok" role="status"><span class="sym" aria-hidden="true">✓</span><div><b>예시 결과: 3 / 5 맞음</b><p>추천 시작 단위: F-P3. F-P7 에러 메시지 읽기와 F-P9 torch 텐서 기초는 꼭 보시길 권합니다.</p></div></div></div>
</div>
<div class="lay" style="margin-top:var(--s5)">
<section class="card" aria-labelledby="py"><div class="row"><h2 id="py" class="t3">파이썬 최소</h2><span class="sp"></span><span class="cap num">2 / 9</span></div><div style="margin-top:var(--s2)">{mods(PY,2,3,("F-P7","F-P9"))}</div></section>
<section class="card" aria-labelledby="ma"><div class="row"><h2 id="ma" class="t3">수학 최소</h2><span class="sp"></span><span class="cap num">0 / 6</span></div><div style="margin-top:var(--s2)">{mods(MA,0,0)}</div></section>
</div>
<div class="next small" style="margin-top:var(--s5)"><b>다음:</b><span>F-P3 · 리스트와 딕셔너리</span></div>'''
(OUT/"s8_basics.html").write_text(page("s8_basics","사전 기초",s8,"basics",wide=True))

# ---------- 9 빈·로딩·오류 상태 ----------
EXTRA["s9_states"] = """
.lay{display:grid;gap:var(--s5)}
@media(min-width:1024px){.lay{grid-template-columns:repeat(3,1fr);align-items:start}}
.sk{background:var(--paper-sunken);border-radius:var(--r-sm);height:14px}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3)}
.stat{padding:var(--s4)}
.err{border:1px solid var(--retry);border-left-width:3px}\n.pst{display:grid;gap:var(--s5)}.tf{display:flex;align-items:center;gap:6px;flex:1}.tf input{width:100%;text-align:right;font-variant-numeric:tabular-nums}.tf span{font-size:14px;font-weight:600;white-space:nowrap}.pst .player .sub{display:none}@media(min-width:1024px){.pst{grid-template-columns:repeat(4,1fr);align-items:start}}
"""
s9=f'''<h1 class="t1" style="margin-bottom:var(--s5)">빈 화면·불러오는 중·오류</h1>
<div class="lay">
<section class="stack" aria-labelledby="e1"><p id="e1" class="kicker">빈 상태: 처음 연 날</p>
 <div class="card current stack"><h2 class="t2">어디서부터 시작할까요?</h2><p class="small">코드를 처음 본다면 사전 기초부터, 파이썬을 조금 읽을 수 있다면 강의 01부터 시작하세요.</p><a class="btn primary block" href="#">사전 기초부터</a><a class="btn block" href="#">강의 01 micrograd부터</a></div>
 <div class="stats"><div class="card stat"><p class="cap">완료 단계</p><p class="big">0</p><p class="delta">–</p></div><div class="card stat"><p class="cap">이번 주 실습 시간</p><p class="big">–</p><p class="delta">아직 기록 없음</p></div></div>
 <div class="card"><p class="small"><b>오늘 복습할 것이 없습니다.</b></p><p class="cap">확인 문제를 풀면 틀린 문제와 핵심 개념이 여기에 모입니다.</p></div>
</section>
<section class="stack" aria-labelledby="e2" aria-busy="true"><p id="e2" class="kicker">불러오는 중</p>
 <div class="card stack"><p class="small muted" role="status">진도를 불러오는 중입니다</p><div class="sk" style="width:40%"></div><div class="sk" style="width:85%;height:22px"></div><div class="sk" style="width:60%"></div><div class="sk" style="height:48px;border-radius:10px"></div></div>
 <div class="card stack"><p class="small muted">노트북 링크를 확인하는 중입니다</p><div class="sk" style="width:70%"></div></div>
 <p class="cap">0.3초 안에 끝나면 이 화면을 보여 주지 않습니다. 움직이는 효과는 쓰지 않습니다.</p>
</section>
<section class="stack" aria-labelledby="e3"><p id="e3" class="kicker">오류</p>
 <div class="card err stack" role="alert"><p class="t3" style="color:var(--retry)">✕ 진도를 저장하지 못했습니다</p><p class="small">인터넷 연결을 확인한 뒤 다시 시도해 주세요. 지금까지 한 내용은 이 기기에 남아 있습니다.</p><button class="btn primary block">다시 저장</button></div>
 <div class="card err stack" role="alert"><p class="t3" style="color:var(--retry)">✕ 비교할 결과가 비어 있습니다</p><p class="small">노트북에서 실행한 뒤 출력 칸의 글자를 복사해 붙여 넣어 주세요.</p></div>
 </section></div>
<h2 class="t2" style="margin:var(--s8) 0 var(--s4)">진도 동기화 (맥미니 서버)</h2>
<div class="pst">
<div class="stack"><p class="kicker">저장됨</p><div class="card row"><span class="sync">✓ 저장됨</span><span class="cap">휴대폰과 맥에서 이어집니다</span></div></div>
<div class="stack"><p class="kicker">동기화 중</p><div class="card row"><span class="sync busy">↻ 동기화 중</span><span class="cap">잠시만요</span></div></div>
<div class="stack"><p class="kicker">오프라인</p><div class="card stack err" role="alert"><span class="sync off">✕ 오프라인</span><p class="small">맥미니 서버에 연결하지 못했습니다. 이 기기에 먼저 저장해 두었고, 연결되면 자동으로 다시 보냅니다.</p><button class="btn primary block">지금 다시 시도</button></div></div>
<div class="stack"><p class="kicker">예측 칸 (보여야 하는 것 가림)</p><div class="card stack"><p class="small"><b>2 · 보여야 하는 것</b></p><p class="small">실행 전에 무엇이 나올지 적어 보세요. 점수에 들어가지 않습니다.</p><input type="text" aria-label="내 예측" placeholder="예: Value(data=2.0)"><div class="row"><button class="btn">모르겠어요</button><button class="btn primary" style="flex:1">예측 저장하고 보기</button></div><p class="cap">모르겠어요를 누르면 바로 보여 드립니다.</p></div></div>
<div class="stack"><p class="kicker">실습 시간 수정</p><div class="card stack"><p class="cap">이번 주 실습 시간 · 자동 기록 2:25</p><div class="row"><label class="tf"><input type="text" value="2" aria-label="시간" inputmode="numeric"><span>시간</span></label><label class="tf"><input type="text" value="40" aria-label="분" inputmode="numeric"><span>분</span></label></div><div class="row"><button class="btn">취소</button><button class="btn primary" style="flex:1">저장</button></div><button class="btn ghost sm">자동 기록으로 되돌리기</button></div></div>
</div>
<h2 class="t2" style="margin:var(--s8) 0 var(--s4)">영상 플레이어 상태</h2>
<div class="pst">
<div class="stack"><p class="kicker">준비됨 (자동 재생 없음)</p>{player("ready")}</div>
<div class="stack"><p class="kicker">불러오는 중</p>{player("loading")}</div>
<div class="stack"><p class="kicker">오류: 임베드 실패</p>{player("error")}</div>
<div class="stack"><p class="kicker">접힘 (모바일 실습 기본)</p>{player(collapsed=True)}</div>
<div class="stack"><p class="kicker">구간 준비 중 (시각 없음)</p>{player("pending",rng="구간 준비 중")}</div>
</div>'''
(OUT/"s9_states.html").write_text(page("s9_states","상태",s9,"home",wide=True))
print("generated")

# ---------- 10 L08 강연 단계 ----------
EXTRA["s10_l08"] = """
.lay{display:grid;gap:var(--s5)}
@media(min-width:1024px){.lay{grid-template-columns:1fr 340px;align-items:start}}
.cells{display:grid;gap:var(--s2);list-style:none;padding:0;margin:0}
.cells li{display:flex;gap:var(--s3);align-items:flex-start;padding:var(--s3) var(--s4);border:1px solid var(--line);border-radius:var(--r-md);background:var(--paper-raised)}
.cells li .n{flex:none;width:28px;height:28px;border-radius:50%;background:var(--paper-sunken);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.cells li[aria-current]{border:2px solid var(--accent)}
.cells li[aria-current] .n{background:var(--accent);color:var(--on-accent)}
.cells li b{display:block}
@media(min-width:1024px){.cells{grid-template-columns:repeat(3,1fr)}}
.blank{font-size:17px;line-height:1.8}
.opt{border:1px dashed var(--line-strong)}
textarea.long{font-family:var(--font-ui);font-size:16px;min-height:96px}
"""
s10=f'''<div class="stack">
<p class="cap">08 State of GPT (강연) · <span class="num">단계 3 / 8</span> · L08-S03</p>
<h1 class="t1">기본 모델과 비서 모델 비교 카드</h1>
<ol class="cells" aria-label="이 단계의 세 칸">
 <li><span class="n">1</span><div><b>보기</b><span class="small">기본 모델에 질문을 던지면 어떻게 반응하는지 설명하는 부분</span></div></li>
 <li aria-current="step"><span class="n">2</span><div><b>정리 카드 채우기</b><span class="small">빈칸 한 곳을 내 말로</span></div></li>
 <li><span class="n">3</span><div><b>내 말로 설명</b><span class="small">카드를 보고 한 문장 더</span></div></li>
</ol>
</div>
<div class="lay" style="margin-top:var(--s5)"><div class="stack">
<section class="card stack" aria-labelledby="sc">
 <h2 id="sc" class="t3">정리 카드</h2>
 <p class="blank">기본 모델은 답 대신 <b>______</b> 한다.</p>
 <label for="card" class="small" style="font-weight:600">빈칸에 들어갈 말</label>
 <textarea id="card" class="long">질문을 글의 일부로 보고 비슷한 질문을 계속 이어 쓴다</textarea>
 <button class="btn primary block">카드 저장하고 정답 예 보기</button>
 <div class="result ok" role="status"><span class="sym" aria-hidden="true">✓</span><div><b>저장됨</b><p>정답 예: 질문을 문서의 일부로 보고 비슷한 글을 계속 이어 씁니다. 기본 모델은 문서를 이어 쓰는 기계입니다.</p></div></div>
</section>
<section class="card stack opt" aria-labelledby="op">
 <div class="row"><span class="badge">선택 실습</span><span class="cap">L08-S04 · 맥미니 또는 Colab</span></div>
 <h2 id="op" class="t3">다음: 기본 모델 직접 보기</h2>
 <p class="small">공개된 GPT-2 작은 모델로 영어 질문을 이어 쓰게 해 봅니다. 하지 않아도 이 편을 익힐 수 있습니다.</p>
 <div class="row"><button class="btn">건너뛰기</button><button class="btn primary" style="flex:1">해 보기</button></div>
 <p class="cap">건너뛰면 목록에 "건너뜀 (선택)"으로 남고, 나중에 언제든 할 수 있습니다.</p>
</section>
</div>
<aside class="stack">
 {player(collapsed=False, rng="8:13–13:24")}
 <section class="card stack"><p class="cap num">단계 3 / 8 · 08 State of GPT</p><div class="bar" aria-hidden="true"><i style="width:25%"></i></div>
 <div class="next small"><b>다음:</b><span>단계 4 (선택) · 기본 모델 직접 보기</span></div></section>
</aside></div>'''
(OUT/"s10_l08.html").write_text(page("s10_l08","08 강연 단계",s10,"lectures",back="강의 개요로",wide=True))
print("s10 ok")
