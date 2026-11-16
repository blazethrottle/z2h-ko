# Z2H v1.3(누적 점검) + v2(랜딩·맛보기·배지·공유 카드·가입) 목업 생성기. gen.py의 공통 함수를 그대로 쓴다.
exec(open(__file__.replace('gen_v2.py','gen.py')).read())
TEMP='<span class="tmp">임시 문구 · 교사 VALUE_CURRICULUM 대기</span>'
def lpage(name,title,body,right=None):
    right = right or '<a class="btn ghost sm" href="#">로그인</a><a class="btn sm" href="#">30분 맛보기 시작</a>'
    return icons(f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><link rel="stylesheet" href="z2h.css"><link rel="stylesheet" href="z2h_v2.css"><style>{EXTRA.get(name,"")}</style></head><body>
<header class="topbar lbar"><span class="brand">Z2H<small>제로 투 히어로 실습</small></span><span class="sp"></span><span class="sample">예시 화면</span>{right}</header>
<main class="wide">{body}</main></body></html>''')

# ================= v1.3 누적 점검 =================
EXTRA["c1_cp_intro"]=""".comp{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s2)}.comp div{padding:var(--s3);border:1px solid var(--line);border-radius:var(--r-md);background:var(--paper-raised)}.comp b{display:block;font-size:26px;font-variant-numeric:tabular-nums;line-height:1.2}.rules{margin:0;padding-left:1.2em}.rules li+li{margin-top:6px}.lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.3fr 1fr;align-items:start}}"""
c1='''<div class="lay"><div class="stack">
<p class="kicker">누적 점검 1 · CP1</p>
<h1 class="t1">01~03편을 한 번에 꺼내 봅니다</h1>
<p class="muted">04편을 열기 전에, 지금까지 만든 것을 내 손으로 다시 확인하는 시간입니다. 약 1시간, 시간 제한은 없습니다.</p>
<div class="comp" aria-label="구성"><div><span class="cap">개념</span><b>6</b><span class="cap">문항</span></div><div><span class="cap">예측</span><b>4</b><span class="cap">문항</span></div><div><span class="cap">손으로</span><b>1</b><span class="cap">과제</span></div></div>
<a class="btn primary block" href="#">점검 시작</a>
<div class="next small"><b>다음:</b><span>문항 1 / 11 · 기울기의 뜻 (개념)</span></div>
</div>
<section class="card stack" aria-labelledby="rl"><h2 id="rl" class="t3">이렇게 진행됩니다</h2>
<ul class="rules small"><li>힌트를 뺀 점수가 80% 이상이면 통과입니다.</li><li>힌트는 2단계까지 쓸 수 있습니다.</li><li>시간 제한은 없습니다. 중간에 멈춰도 이어서 할 수 있습니다.</li><li>손으로 하는 과제는 빈 노트북에서 2편 신경망 바이그램의 학습 반복을 쓰고, 줄마다 내 말로 풀이를 답니다.</li><li>이번에 통과하지 못해도 괜찮습니다. 놓친 편을 복습하고 3일 뒤 다시 볼 수 있습니다.</li></ul>
<p class="cap">통과하면 04편이 열리고 "누적 점검 1" 배지가 생깁니다.</p></section>
</div>'''
(OUT/"c1_cp_intro.html").write_text(page("c1_cp_intro","누적 점검 안내",c1,"lectures",back="홈으로",wide=True))

EXTRA["c2_cp_item"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.3fr 1fr;align-items:start}}textarea.long{font-family:var(--font-ui);font-size:16px;min-height:120px}.rung{border:1px solid var(--line);border-radius:var(--r-md);padding:var(--s3) var(--s4);background:var(--paper-raised)}.rung.locked{background:var(--paper);color:var(--ink-muted)}.rung.open{border-left:3px solid var(--accent)}.ladder{list-style:none;margin:0;padding:0;display:grid;gap:var(--s2)}"""
c2='''<div class="stack"><p class="cap">누적 점검 1 · <span class="num">문항 3 / 11</span> · 개념</p>
<div class="bar" aria-hidden="true"><i style="width:27%"></i></div></div>
<div class="lay" style="margin-top:var(--s5)">
<section class="card stack" aria-labelledby="q"><div class="row"><span class="badge cur">내 말로 설명</span><span class="cap">01편 개념</span></div>
<h1 id="q" class="t2">역전파가 노드를 계산 순서의 반대로 도는 이유를 내 말로 설명해 보세요.</h1>
<label for="a" class="small" style="font-weight:600">내 설명</label>
<textarea id="a" class="long">결과 쪽에서 기울기가 다 모여야 재료에게 나눠 줄 수 있어서 거꾸로 간다.</textarea>
<button class="btn primary block">제출</button>
<p class="cap">제출하면 채점 기준이 열리고, 내 설명에 들어 있는 것을 직접 고릅니다.</p>
</section>
<section class="card stack" aria-labelledby="h"><h2 id="h" class="t3">힌트 (점검에서는 2단계까지)</h2>
<ol class="ladder"><li class="rung open"><b>1. 질문으로 생각하기</b><p class="small">재료에게 기울기를 나눠 주려면, 그 전에 무엇이 끝나 있어야 할까요?</p></li>
<li class="rung"><b>2. 개념과 위치 짚기</b><p class="cap">이 힌트를 열면 이 문항은 80%로 계산됩니다.</p><button class="btn block" style="margin-top:8px">2단계 힌트 열기</button></li>
<li class="rung locked"><b>3·4단계</b><p class="cap">점검에서는 쓰지 않습니다. 점검이 끝나면 복습에서 볼 수 있습니다.</p></li></ol>
<p class="cap num">지금까지 힌트 쓴 문항: 1 / 3</p></section>
</div>'''
(OUT/"c2_cp_item.html").write_text(page("c2_cp_item","누적 점검 문항",c2,"lectures",back="점검 안내로",wide=True))

EXTRA["c3_cp_hands"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.4fr 1fr;align-items:start}}
.pair{display:grid;gap:0;border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.pr{display:grid;grid-template-columns:1fr}.pr .cd{background:var(--code-bg);color:var(--code-text);font-family:var(--font-code);font-size:13.5px;padding:10px 14px;white-space:pre-wrap;overflow-wrap:anywhere;font-variant-ligatures:none;border-top:1px solid #262C3E}
.pr input{border:0;border-top:1px solid var(--line);border-radius:0;min-height:44px;font-size:15px}
@media(min-width:1024px){.pr{grid-template-columns:1.1fr 1fr}.pr input{border-top:1px solid var(--line);border-left:1px solid var(--line)}}
.rub{list-style:none;padding:0;margin:0;display:grid;gap:var(--s2)}.rub label{display:flex;gap:var(--s3);align-items:flex-start;min-height:44px;padding:var(--s2) var(--s3);border:1px solid var(--line-strong);border-radius:var(--r-md);background:var(--paper-raised)}.rub input{width:22px;height:22px;margin:2px 0 0;accent-color:var(--accent);flex:none}"""
CPC=[("for k in range(100):","100번 되풀이합니다."),("    xenc = F.one_hot(xs, num_classes=27).float()","글자 번호를 27칸짜리 표시로 바꿉니다."),("    logits = xenc @ W","가중치 표를 곱해 다음 글자 점수를 냅니다."),("    probs = logits.exp() / logits.exp().sum(1, keepdims=True)","점수를 확률로 바꿉니다."),("    loss = -probs[torch.arange(num), ys].log().mean()","정답 글자 확률이 얼마나 낮은지 평균 냅니다."),("    W.grad = None","지난번 기울기를 비웁니다."),("    loss.backward()","기울기를 구합니다."),("    W.data += -50 * W.grad","기울기 반대 방향으로 조금 움직입니다.")]
rows="".join(f'<div class="pr"><div class="cd">{c}</div><input type="text" value="{e}" aria-label="{i}번 줄 내 풀이"></div>' for i,(c,e) in enumerate(CPC,1))
c3=f'''<div class="stack"><p class="cap">누적 점검 1 · <span class="num">문항 11 / 11</span> · 손으로 하는 과제</p>
<h1 class="t1">빈 노트북에서 학습 반복 쓰기</h1>
<p>2편 신경망 바이그램의 학습 반복(순전파, 손실, 기울기 비우기, 역전파, 갱신)을 빈 노트북에 직접 쓰고 실행한 뒤, 코드를 붙여 넣으세요. 줄마다 내 말로 풀이를 답니다.</p></div>
<div class="lay" style="margin-top:var(--s5)"><div class="stack">
<section class="stack" aria-labelledby="cd"><h2 id="cd" class="t3">1 · 내 코드와 줄별 풀이 (예시)</h2><div class="pair">{rows}</div><button class="btn sm">코드 다시 붙여넣기</button></section>
<section class="card stack" aria-labelledby="cm"><h2 id="cm" class="t3">2 · 결과 비교</h2>
<p class="small">기준: 원본 makemore 신경망 바이그램, 학습 뒤 손실 약 2.5 (예시 기준값)</p>
<label for="o" class="small" style="font-weight:600">내 노트북의 마지막 손실</label><input id="o" type="text" value="2.4823">
<div class="result ok" role="status"><span class="sym" aria-hidden="true">✓</span><div><b>범위 안</b><p>기준 범위(예시 2.45~2.55) 안입니다.</p></div></div></section>
</div>
<section class="card stack" aria-labelledby="rb"><h2 id="rb" class="t3">3 · 채점 기준 (스스로 확인)</h2>
<ul class="rub"><li><label><input type="checkbox" checked><span>순전파, 손실, 비우기, 역전파, 갱신 5가지가 모두 있다</span></label></li><li><label><input type="checkbox" checked><span>기울기 비우기가 역전파보다 앞에 있다</span></label></li><li><label><input type="checkbox" checked><span>갱신이 기울기 반대 방향(빼기)이다</span></label></li><li><label><input type="checkbox" checked><span>줄마다 내 말 풀이가 있다 (지금 8줄 중 8줄)</span></label></li></ul>
<p class="cap">힌트는 2단계까지 쓸 수 있습니다. 지금 이 과제 힌트: 0</p>
<button class="btn primary block">과제 제출하고 결과 보기</button></section>
</div>'''
(OUT/"c3_cp_hands.html").write_text(page("c3_cp_hands","누적 점검 손 과제",c3,"lectures",back="문항으로",wide=True))

EXTRA["c4_cp_result"]=""".two{display:grid;gap:var(--s5)}@media(min-width:1024px){.two{grid-template-columns:1fr 1fr;align-items:start}}.score{font-size:44px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}.lst{margin:0;padding-left:1.2em}.lst li+li{margin-top:4px}"""
c4='''<h1 class="t1" style="margin-bottom:var(--s5)">누적 점검 1 결과</h1>
<div class="two">
<section class="card current stack" aria-labelledby="p"><p class="kicker">통과한 경우 (예시)</p>
<h2 id="p" class="t2">✓ 누적 점검 1을 통과했습니다</h2>
<p class="score">86%</p><p class="cap num">기준 80% · 힌트를 뺀 점수 · 11문항</p>
<ul class="lst small"><li>개념 6문항 중 5문항, 예측 4문항 모두, 손 과제 통과</li><li>04편 활성값·기울기·BatchNorm이 열렸습니다</li><li>"누적 점검 1" 배지가 생겼습니다</li></ul>
<a class="btn primary block" href="#">04편 시작</a><a class="btn block" href="#">배지 보기</a>
<div class="next small"><b>다음:</b><span>04편 단계 1 / 12</span></div></section>
<section class="card stack" aria-labelledby="n"><p class="kicker">아직인 경우 (예시)</p>
<h2 id="n" class="t2">이번에는 72%였습니다</h2>
<p class="cap num">기준 80% · 힌트를 뺀 점수 · 11문항</p>
<p class="small">다시 보면 좋은 곳이 분명해졌습니다. 아래 편의 복습 카드를 1일 간격으로 되돌려 두었습니다.</p>
<ul class="lst small"><li>02편: 확률표와 keepdim (예측 2문항)</li><li>03편: 임베딩 C[X]의 모양 (개념 1문항)</li></ul>
<p class="small"><b class="num">11월 19일 (목)</b>부터 점검을 다시 볼 수 있습니다. 그 전에는 복습을 해 두면 충분합니다.</p>
<a class="btn primary block" href="#">복습 시작</a>
<div class="next small"><b>다음:</b><span>오늘 복습 4장 · 약 10분</span></div></section>
</div>'''
(OUT/"c4_cp_result.html").write_text(page("c4_cp_result","누적 점검 결과",c4,"lectures",back="홈으로",wide=True))

# ================= v2 =================
JOURNEY=[("00","사전 기초","8~12시간","파이썬과 수학을 읽는 눈"),("01","micrograd","8~12시간","내가 만든 자동 미분 엔진과 작은 신경망"),("02","makemore 1","6~10시간","새 이름을 지어 내는 첫 언어 모델"),("03","makemore 2","5~8시간","더 그럴듯한 이름을 짓는 신경망 (MLP)"),("CP1","누적 점검 1","약 1시간","01~03편 확인"),("04","BatchNorm","6~10시간","신경망 건강 진단 그래프"),("05","Backprop Ninja","8~12시간","손으로 쓴 역전파로 학습한 모델"),("06","WaveNet","4~6시간","8글자 문맥을 보는 이름 생성기"),("CP2","누적 점검 2","약 1.5시간","01~06편 확인"),("07","GPT 만들기","8~12시간","셰익스피어 흉내 글을 쓰는 나만의 작은 GPT"),("08","State of GPT","2~3시간","ChatGPT가 만들어지는 4단계 정리 카드"),("09","토크나이저","8~12시간","한글도 쪼개는 직접 만든 BPE 토크나이저"),("10","GPT-2 축소판","14~20시간","GPT-2 구조를 내 장비에서 학습·평가한 기록"),("CP3","누적 점검 3","약 2시간","수료")]
EXTRA["v2_landing"]=""".hero{display:grid;gap:var(--s5);padding:var(--s6) 0 var(--s8)}
.hero h1{font-size:30px;line-height:1.35;font-weight:700;letter-spacing:-0.4px}
.cta{display:flex;gap:var(--s3);flex-wrap:wrap}
.sec{padding:var(--s8) 0;border-top:1px solid var(--line)}
.sec h2{margin-bottom:var(--s4)}
.gets{display:grid;gap:var(--s3)}
.get{display:flex;gap:var(--s3);align-items:flex-start}
.get .ic2{flex:none;width:40px;height:40px;border-radius:var(--r-md);background:var(--paper-sunken);display:flex;align-items:center;justify-content:center;font-family:var(--font-code);font-size:13px;font-weight:600;color:var(--accent)}
.aud{display:grid;gap:var(--s3)}
.path{list-style:none;margin:0;padding:0;position:relative}
.path li{display:grid;grid-template-columns:52px 1fr;gap:var(--s3);padding:var(--s2) 0;position:relative}
.path li::before{content:"";position:absolute;left:25px;top:0;bottom:0;width:2px;background:var(--line)}
.path .dot{position:relative;z-index:1;width:52px;height:32px;border-radius:var(--r-pill);background:var(--paper-raised);border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
.path li.cp .dot{border-style:dashed;color:var(--ink-muted)}
.path li.first .dot{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.path .t{font-weight:600}.path .m{font-size:13px;color:var(--ink-muted);font-variant-numeric:tabular-nums}
.ev{display:grid;gap:var(--s3)}
.mini-code{border-radius:var(--r-md);overflow:hidden;border:1px solid var(--line)}
.mini-code .r{display:grid;grid-template-columns:1fr}
.mini-code .c{background:var(--code-bg);color:var(--code-text);font-family:var(--font-code);font-size:13px;padding:8px 12px;white-space:pre-wrap;font-variant-ligatures:none}
.mini-code .e{background:var(--paper-raised);padding:8px 12px;font-size:14px;border-top:1px solid var(--line)}
.no-list{margin:0;padding-left:1.2em}
@media(min-width:1024px){.hero{grid-template-columns:1.1fr 1fr;align-items:center;padding:var(--s14) 0}.hero h1{font-size:40px}.gets{grid-template-columns:repeat(3,1fr)}.aud{grid-template-columns:repeat(4,1fr)}.ev{grid-template-columns:repeat(4,1fr)}.path{columns:2;column-gap:var(--s10)}.path li{break-inside:avoid}.mini-code .r{grid-template-columns:1.1fr 1fr}.mini-code .e{border-top:0;border-left:1px solid var(--line)}}
"""
path="".join(f'<li class="{"cp" if n.startswith("CP") else ("first" if n=="01" else "")}"><span class="dot">{n}</span><div><span class="t">{t}</span> <span class="m">· 약 {h}</span><br><span class="small">{a}</span></div></li>' for n,t,h,a in JOURNEY)
v1=f'''<section class="hero"><div class="stack">
{TEMP}
<h1>코드를 몰라도, 한 줄씩 직접 쳐 보며<br>GPT를 처음부터 만들어 봅니다</h1>
<p class="muted">Andrej Karpathy의 강의 "Neural Networks: Zero to Hero" 10편을 한국어 줄별 풀이와 함께 따라 하는 실습 노트입니다. 영상은 YouTube 원본을 그대로 보여 드립니다.</p>
<div class="cta"><a class="btn primary" href="#">30분 맛보기 시작</a><a class="btn" href="#">로그인</a></div>
<p class="cap">맛보기는 가입 없이, 설치 없이 브라우저에서 바로 됩니다.</p>
</div>
<div class="mini-code" aria-label="실습 화면 예시"><div class="r"><div class="c">a = Value(2.0)</div><div class="e">숫자 2.0을 담은 상자 a를 만듭니다.</div></div><div class="r"><div class="c">c = a + b</div><div class="e">더하기를 하면서 a와 b가 재료라는 것을 기록합니다.</div></div><div class="r"><div class="c">c.backward()</div><div class="e">결과에서 거꾸로 가며 기울기를 채웁니다.</div></div><div class="r"><div class="c">print(a.grad)</div><div class="e">a를 조금 바꾸면 c가 얼마나 바뀌는지 봅니다.</div></div></div>
</section>
<section class="sec" aria-labelledby="g"><h2 id="g" class="t2">끝내면 얻는 것</h2><div class="gets">
<div class="get"><span class="ic2">01</span><div><b>나만의 micrograd</b><p class="small muted">숫자의 기울기를 스스로 계산하는 작은 엔진과, 그것으로 학습하는 신경망</p></div></div>
<div class="get"><span class="ic2">02</span><div><b>이름 짓는 언어 모델</b><p class="small muted">이름 수만 개를 읽고 새 이름을 지어 내는 모델. 바이그램부터 WaveNet 모양까지</p></div></div>
<div class="get"><span class="ic2">07</span><div><b>나만의 작은 GPT</b><p class="small muted">셰익스피어 글을 읽고 비슷한 글을 써 내는 트랜스포머를 한 줄씩 직접</p></div></div>
<div class="get"><span class="ic2">09</span><div><b>직접 만든 토크나이저</b><p class="small muted">글을 조각으로 나누는 BPE. 한글이 몇 조각이 되는지 내 눈으로 확인</p></div></div>
<div class="get"><span class="ic2">10</span><div><b>GPT-2 축소판 학습 기록</b><p class="small muted">GPT-2와 같은 구조를 내 장비에서 학습하고 평가한 노트북</p></div></div>
<div class="get"><span class="ic2">08</span><div><b>ChatGPT를 이해하는 눈</b><p class="small muted">사전학습부터 강화학습까지 4단계를 내 말로 정리한 카드</p></div></div>
</div><p class="cap" style="margin-top:var(--s4)">원본 규모 GPT-2 재현은 유료 GPU가 필요해 넣지 않았습니다. 10편은 축소판으로 전 과정을 실습합니다.</p></section>
<section class="sec" aria-labelledby="w"><h2 id="w" class="t2">이런 분께 맞습니다</h2><div class="aud">
<div class="card"><b>AI를 매일 쓰지만 속이 궁금한 분</b><p class="small muted">ChatGPT가 어떻게 글을 만드는지 말이 아니라 손으로 확인하고 싶은 분</p></div>
<div class="card"><b>코드를 처음 보는 기획자·마케터</b><p class="small muted">개발자와 AI 이야기를 같은 말로 하고 싶은 분</p></div>
<div class="card"><b>AI 도입을 앞둔 팀장·대표</b><p class="small muted">무엇이 되고 무엇이 어려운지 직접 가늠하고 싶은 분</p></div>
<div class="card"><b>천천히 오래 배우는 학습자</b><p class="small muted">하루 1~2시간, 내 속도로 끝까지 가고 싶은 분</p></div>
</div></section>
<section class="sec" aria-labelledby="j"><h2 id="j" class="t2">수료까지의 길</h2><p class="small muted" style="margin-bottom:var(--s4)">하루 1~2시간, 주 5일이면 약 4~5개월입니다. 시간은 교사 몽키 학습 설계의 예상치입니다.</p><ol class="path">{path}</ol></section>
<section class="sec" aria-labelledby="e"><h2 id="e" class="t2">코드를 몰라도 할 수 있는 이유</h2><div class="ev">
<div class="card stack"><b>코드 한 줄마다 한국어 풀이</b><p class="small muted">모든 줄 옆에 쉬운 말 설명이 붙습니다. 풀이 없는 코드는 내보내지 않습니다.</p></div>
<div class="card stack"><b>4단계 힌트</b><p class="small muted">질문 → 볼 곳 → 빈칸 코드 → 정답과 풀이. 필요한 만큼만 하나씩 엽니다.</p></div>
<div class="card stack"><b>사전 기초 15단위</b><p class="small muted">파이썬 읽기 9단위, 수학 6단위. 진단 5문제로 어디서 시작할지 추천합니다.</p></div>
<div class="card stack"><b>한 번에 한 걸음</b><p class="small muted">단계마다 새 코드 몇 줄과 새 개념 하나. 입력할 것, 보여야 하는 것, 그 뜻 세 칸으로 갑니다.</p></div>
</div></section>
<section class="sec stack" aria-labelledby="s"><h2 id="s" class="t2">먼저 30분만 해 보세요</h2><p class="muted">숫자 상자를 만들고, 더하기의 기울기를 직접 구해 봅니다. 가입은 끝나고 원할 때만 하면 됩니다.</p><div class="cta"><a class="btn primary" href="#">30분 맛보기 시작</a><a class="btn" href="#">로그인</a></div></section>
<footer class="sec cap">영상: Andrej Karpathy, YouTube 원본 임베드와 링크. 이 앱은 영상을 다시 올리지 않습니다. · 이용약관 · 개인정보 처리방침</footer>'''
(OUT/"v2_landing.html").write_text(lpage("v2_landing","Z2H 소개",v1))

# 맛보기 단계 화면
EXTRA["v2_taste_step"]=""".tsteps{display:flex;gap:6px;list-style:none;padding:0;margin:0}.tsteps li{flex:1;height:6px;border-radius:3px;background:var(--paper-sunken)}.tsteps li.d{background:var(--correct)}.tsteps li.c{background:var(--accent)}
.lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.4fr 1fr;align-items:start}}
.ed{border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--line)}.ed .top{display:flex;align-items:center;gap:var(--s2);padding:var(--s2) var(--s2) var(--s2) var(--s4);background:var(--code-bg);color:var(--code-comment);font-size:13px}.ed .top .btn{background:transparent;color:var(--code-text);border-color:#4A5470}
.ln2{display:grid;grid-template-columns:1fr}.ln2 .c{background:var(--code-bg);color:var(--code-text);font-family:var(--font-code);font-size:13.5px;padding:10px 14px;white-space:pre-wrap;font-variant-ligatures:none;border-top:1px solid #262C3E}.ln2 .e{background:var(--paper-raised);padding:10px 14px;font-size:15px;border-top:1px solid var(--line)}
@media(min-width:1024px){.ln2{grid-template-columns:1.1fr 1fr}.ln2 .e{border-left:1px solid var(--line)}}
.run{display:flex;gap:var(--s2);flex-wrap:wrap}.prep{font-size:14px}"""
TC=[('a = Value(<span class="n">2.0</span>)',"숫자 2.0을 담은 상자 a"),('b = Value(<span class="n">-3.0</span>)',"숫자 -3.0을 담은 상자 b"),("c = a + b","더하기. c는 a와 b가 재료라는 것을 기억합니다"),("c.backward()","c에서 거꾸로 가며 기울기를 채웁니다"),('<span class="k">print</span>(a.grad, b.grad)',"a와 b의 기울기를 봅니다")]
tl="".join(f'<div class="ln2"><div class="c"><span class="ln">{i}</span>{c}</div><div class="e">{e}</div></div>' for i,(c,e) in enumerate(TC,1))
t1=f'''<div class="stack"><div class="row"><p class="kicker">30분 맛보기 · 가입 없이</p><span class="sp"></span><span class="cap num">4 / 5 · 약 8분</span></div>
<ol class="tsteps" aria-label="맛보기 5단계 중 4단계"><li class="d"></li><li class="d"></li><li class="d"></li><li class="c"></li><li></li></ol>
<h1 class="t1">더하기의 기울기 구하기</h1>
<p><b>무엇을 하는 단계인지:</b> 두 숫자를 더한 결과에서 거꾸로 가며, 각 숫자가 결과에 주는 영향(기울기)을 구합니다.</p></div>
<div class="lay" style="margin-top:var(--s5)"><div class="stack">
<p class="prep cap">앞 단계에서 만든 Value 상자(덧셈과 backward 포함)가 이미 준비되어 있습니다. <a href="#">준비된 코드 보기</a></p>
<section class="ed" aria-labelledby="ed"><div class="top"><span id="ed">코드 5줄 · 브라우저에서 바로 실행</span><span class="sp"></span><button class="btn sm">⧉ 복사</button></div>{tl}</section>
<div class="run"><button class="btn primary" style="flex:1">▶ 실행</button><a class="btn" href="#">Colab에서 열기 ↗</a></div>
<section class="card stack" aria-labelledby="o"><h2 id="o" class="t3">실행 결과</h2><pre class="out" style="margin:0">1.0 1.0</pre>
<div class="result ok" role="status"><span class="sym" aria-hidden="true">✓</span><div><b>맞음</b><p>보여야 하는 것과 같습니다. 더하기는 받은 기울기를 두 재료에게 그대로 나눠 줍니다.</p></div></div></section>
</div>
<aside class="stack"><section class="card stack" aria-labelledby="ex"><h2 id="ex" class="t3">보여야 하는 것</h2><pre class="out" style="margin:0">1.0 1.0</pre><p class="small">a를 아주 조금 올리면 c도 똑같이 그만큼 오릅니다. 그래서 기울기가 1입니다.</p></section>
<section class="card stack"><h2 class="t3">막혔나요?</h2><button class="btn block">1단계 힌트 열기</button><p class="cap">맛보기는 점수가 없습니다.</p></section>
<div class="next small"><b>다음:</b><span>5 / 5 · 곱하기의 기울기 (약 6분)</span></div>
<p class="cap">실행 환경을 불러오지 못하면 "Colab에서 열기"로 같은 노트북을 열 수 있습니다.</p></aside></div>'''
(OUT/"v2_taste_step.html").write_text(lpage("v2_taste_step","30분 맛보기",t1,right='<a class="btn ghost sm" href="#">로그인</a>'))

EXTRA["v2_taste_done"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.2fr 1fr;align-items:start}}.did{margin:0;padding-left:1.2em}.did li+li{margin-top:6px}.res{font-family:var(--font-code);font-size:15px;background:var(--code-bg);color:var(--code-text);border-radius:var(--r-md);padding:var(--s4);white-space:pre;font-variant-ligatures:none}"""
t2='''<div class="lay"><section class="card current stack" aria-labelledby="d"><p class="kicker">맛보기 끝 · 약 30분</p>
<h1 id="d" class="t1">✓ 신경망 학습의 가장 작은 조각을 직접 만들었습니다</h1>
<h2 class="t3">방금 한 일</h2>
<ol class="did"><li>숫자를 아주 조금 바꿔 보며 기울기가 무엇인지 쟀습니다.</li><li>숫자와 기울기를 함께 담는 상자(Value)를 만들었습니다.</li><li>더하기와 곱하기를 하고, 결과에서 거꾸로 가며 기울기를 채웠습니다.</li></ol>
<h2 class="t3">내 결과</h2>
<pre class="res">a.grad = -3.0   (예시)
b.grad =  2.0</pre>
<p class="small">c = a × b 에서 a를 조금 바꾸면 c는 b만큼(-3배) 바뀝니다. ChatGPT 같은 모델도 이 계산을 수십억 번 되풀이해 배웁니다.</p>
<div class="next small"><b>다음:</b><span>01 micrograd 단계 5 · 덧셈과 곱셈 기록하기</span></div></section>
<section class="card stack" aria-labelledby="s"><h2 id="s" class="t3">진도를 저장하려면 가입하세요 (선택)</h2>
<p class="small">가입하면 맛보기에서 한 5단계가 01 micrograd 진도로 그대로 옮겨집니다. 휴대폰과 컴퓨터에서 이어서 할 수 있습니다.</p>
<a class="btn primary block" href="#">가입하고 이어서 하기</a><a class="btn block" href="#">이미 계정이 있어요 · 로그인</a>
<a class="btn ghost block" href="#">가입하지 않고 둘러보기</a>
<p class="cap">가입하지 않으면 맛보기 진도는 이 브라우저에만 7일 동안 남습니다.</p>
<hr class="rule"><a class="btn block" href="#">이 결과로 공유 카드 만들기</a></section></div>'''
(OUT/"v2_taste_done.html").write_text(lpage("v2_taste_done","맛보기 완료",t2,right='<a class="btn ghost sm" href="#">로그인</a>'))

EXTRA["v2_auth"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1fr 1fr 1fr;align-items:start}}
.auth{max-width:420px}.or{display:flex;align-items:center;gap:var(--s3);color:var(--ink-muted);font-size:13px}.or::before,.or::after{content:"";flex:1;border-top:1px solid var(--line)}
.g{display:inline-flex;width:20px;height:20px;border-radius:50%;border:1px solid var(--line-strong);align-items:center;justify-content:center;font-size:12px;font-weight:700}
.chk{display:flex;gap:var(--s3);align-items:flex-start;min-height:44px;font-size:14px}.chk input{width:22px;height:22px;margin:2px 0 0;accent-color:var(--accent);flex:none}
.carry{display:flex;gap:var(--s3);align-items:flex-start;padding:var(--s3) var(--s4);background:var(--accent-tint);border-radius:var(--r-md);font-size:14px}
.err{border:1px solid var(--retry)!important}.errt{color:var(--retry);font-size:14px;font-weight:600}
.code6{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.code6 input{text-align:center;font-size:20px;font-weight:700;padding:8px 0;font-variant-numeric:tabular-nums}"""
a1='''<div class="lay">
<section class="card stack auth" aria-labelledby="su"><p class="kicker">가입 · 맛보기 진도 이어가기</p><h1 id="su" class="t2">진도를 저장할 계정 만들기</h1>
<div class="carry" role="status"><span>✓</span><span>맛보기에서 한 5단계(01 micrograd)가 이 계정으로 옮겨집니다.</span></div>
<button class="btn block"><span class="g" aria-hidden="true">G</span>Google로 계속하기</button>
<div class="or">또는 이메일</div>
<label for="em" class="small" style="font-weight:600">이메일</label><input id="em" type="text" value="me@example.com" inputmode="email" autocomplete="email">
<label class="chk"><input type="checkbox" checked><span>[필수] <a href="#">이용약관</a>과 <a href="#">개인정보 수집·이용</a>에 동의합니다. 만 14세 이상입니다.</span></label>
<button class="btn primary block">로그인 코드 받기</button>
<p class="cap">비밀번호 없이, 메일로 받은 6자리 코드나 링크로 들어옵니다.</p></section>
<section class="card stack auth" aria-labelledby="cd"><p class="kicker">코드 입력</p><h2 id="cd" class="t2">메일로 보낸 6자리 코드를 넣어 주세요</h2>
<p class="small muted">me@example.com 으로 보냈습니다. 메일 속 링크를 눌러도 됩니다. 코드는 10분 동안 유효합니다.</p>
<div class="code6" role="group" aria-label="6자리 코드"><input type="text" value="4" aria-label="1번째"><input type="text" value="8" aria-label="2번째"><input type="text" value="1" aria-label="3번째"><input type="text" value="0" aria-label="4번째"><input type="text" value="" aria-label="5번째"><input type="text" value="" aria-label="6번째"></div>
<button class="btn primary block">확인</button>
<button class="btn ghost block">코드 다시 받기 (52초 뒤)</button>
<button class="btn ghost block">다른 이메일로</button></section>
<section class="stack" aria-labelledby="er"><p id="er" class="kicker">오류 상태</p>
<div class="card stack"><input type="text" class="err" value="me@example" aria-invalid="true" aria-describedby="e1"><p id="e1" class="errt">✕ 이메일 주소 모양이 아닙니다. @ 뒤에 도메인까지 넣어 주세요.</p></div>
<div class="card stack"><p class="errt">✕ 코드가 맞지 않습니다</p><p class="small">숫자를 다시 확인해 주세요. 5번 틀리면 새 코드를 받아야 합니다.</p></div>
<div class="card stack"><p class="errt">✕ 코드 유효 시간 10분이 지났습니다</p><button class="btn primary block">새 코드 받기</button></div>
<div class="card stack"><p class="errt">✕ 동의가 필요합니다</p><p class="small">이용약관과 개인정보 수집·이용에 동의해야 계정을 만들 수 있습니다.</p></div>
<div class="card stack"><p class="errt">✕ Google 로그인을 마치지 못했습니다</p><p class="small">창을 닫았거나 연결이 끊겼을 수 있습니다. 다시 시도하거나 이메일로 계속하세요.</p></div>
<div class="card stack"><p class="errt">✕ 지금은 서버에 연결할 수 없습니다</p><p class="small">잠시 뒤 다시 시도해 주세요. 맛보기 진도는 이 브라우저에 남아 있습니다.</p><button class="btn block">다시 시도</button></div>
</section></div>'''
(OUT/"v2_auth.html").write_text(lpage("v2_auth","가입·로그인",a1,right='<a class="btn ghost sm" href="#">처음으로</a>'))

BADGES=[("맛보기","첫 기울기","더하기의 기울기를 처음 직접 구함",True),("01","나만의 micrograd","01편 익힘",True),("01-S11","첫 역전파","backward() 한 줄로 기울기를 모두 채움",True),("02-S09","첫 이름 생성","내 모델이 처음 지은 이름",True),("CP1","누적 점검 1","01~03편 통과",False),("05","손으로 역전파","loss.backward() 없이 학습",False),("07","내 GPT의 첫 글","작은 GPT가 처음 쓴 글",False),("09","내 토크나이저","encode 후 decode가 원문과 같음",False),("CP3","수료","10편과 누적 점검 3 통과",False)]
EXTRA["v2_badges"]=""".bg{display:grid;grid-template-columns:1fr;gap:var(--s3)}@media(min-width:600px){.bg{grid-template-columns:repeat(2,1fr)}}@media(min-width:1024px){.bg{grid-template-columns:repeat(3,1fr)}}
.bd{display:flex;gap:var(--s3);align-items:center;padding:var(--s3);border:1px solid var(--line);border-radius:var(--r-lg);background:var(--paper-raised);min-height:76px}
.bd .m{flex:none;width:52px;height:52px;border-radius:50%;border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--accent);background:var(--accent-tint);text-align:center;line-height:1.1;font-variant-numeric:tabular-nums}
.bd.no{background:var(--paper)}.bd.no .m{border:2px dashed var(--line-strong);background:transparent;color:var(--ink-muted)}
.bd b{display:block;font-size:15px}.bd .cap{display:block}
.lay{display:grid;gap:var(--s6)}@media(min-width:1024px){.lay{grid-template-columns:1fr 1fr;align-items:start}}
.prev img{width:100%;border-radius:var(--r-md);border:1px solid var(--line);display:block}"""
bd="".join(f'<div class="bd {"" if got else "no"}"><span class="m">{k.split("-")[0]}</span><div><b>{t}</b><span class="cap">{d}</span><span class="cap num">{"11월 16일 받음 (예시)" if got else "아직"}</span></div></div>' for k,t,d,got in BADGES)
b1=f'''<div class="lay"><section class="stack" aria-labelledby="b"><h1 id="b" class="t1">내 배지</h1><p class="small muted">실제로 만든 것에만 배지가 생깁니다. 연속 기록 배지는 없습니다. 전체 목록은 명세 참고.</p><div class="bg">{bd}</div></section>
<section class="card stack" aria-labelledby="sh"><h2 id="sh" class="t2">공유 카드 미리 보기</h2>
<div class="prev"><img src="../png/card_names.png" alt="공유 카드 미리 보기: 02편 첫 이름 생성, 내 모델이 지은 이름 8개 (예시)"></div>
<p class="small">카드에는 내 모델의 출력, 배지 이름, 앱 이름만 들어갑니다. 이메일과 계정 이름은 넣지 않습니다.</p>
<div class="row"><button class="btn" style="flex:1">이미지 저장</button><button class="btn primary" style="flex:1">X에 공유</button></div>
<p class="cap">X에 공유를 누르면 X의 글쓰기 창이 열리고, 올리기는 내가 직접 누릅니다. 이 앱은 자동으로 올리지 않습니다.</p></section></div>'''
(OUT/"v2_badges.html").write_text(page("v2_badges","배지와 공유",b1,"home",wide=True))

# 공유 카드 1200x675
EXTRA["card"]="""html,body{width:1200px;height:675px;overflow:hidden;background:var(--paper)}
.cardx{box-sizing:border-box;width:1200px;height:675px;padding:56px 64px;display:grid;grid-template-rows:auto 1fr auto;background:var(--paper);border:0}
.top{display:flex;align-items:center;gap:16px}.mk{width:56px;height:56px;border-radius:50%;border:3px solid var(--accent);background:var(--accent-tint);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums}
.ms{font-size:30px;font-weight:700}.sub{font-size:20px;color:var(--ink-muted)}
.out2{margin:36px 0 28px;background:var(--code-bg);color:var(--code-text);border-radius:18px;padding:32px 40px;font-family:var(--font-code);font-size:40px;line-height:1.55;font-variant-ligatures:none;white-space:pre-wrap;overflow:hidden}
.out2 .c{color:var(--code-comment);font-size:20px;display:block;margin-bottom:8px;font-family:var(--font-ui)}
.foot{display:flex;align-items:center;gap:12px;font-size:20px;color:var(--ink-muted)}.foot b{color:var(--ink);font-size:22px}.ex{margin-left:auto;border:1px dashed var(--line-strong);border-radius:999px;padding:2px 14px;font-size:18px}"""
def card(fn,mk,ms,sub,out,label,cols=None):
    body=f'<div class="cardx"><div class="top"><span class="mk">{mk}</span><div><div class="ms">{ms}</div><div class="sub">{sub}</div></div></div><div class="out2"><span class="c">{label}</span>{out}</div><div class="foot"><b>Z2H 제로 투 히어로 실습</b><span>· Karpathy의 Neural Networks: Zero to Hero를 한 줄씩</span><span class="ex">예시</span></div></div>'
    h=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="z2h.css"><style>{EXTRA["card"]}</style></head><body>{body}</body></html>'''
    (OUT/f"{fn}.html").write_text(h)
card("card_names","02","첫 이름 생성","02 makemore · 내 바이그램 모델이 지은 이름","moriah   kaylen   tesha   brandix\nzelora   amiyn   corrie   jaxtin","내 모델 출력 (예시, 실제 카드는 내 노트북 결과)")
card("card_gpt","07","내 GPT의 첫 글","07 GPT 만들기 · 셰익스피어를 읽은 작은 GPT","KING HENRY:\nWhat say you to the hour, my lord?\nThe night is gone, and we shall bear it so.","내 모델 출력 (예시, 실제 카드는 내 노트북 결과)")
card("card_grad","01","첫 역전파","01 micrograd · 내가 만든 Value로 구한 기울기","c = a * b\na.grad = -3.0\nb.grad =  2.0","내 결과 (예시)")
print("v2 ok")
