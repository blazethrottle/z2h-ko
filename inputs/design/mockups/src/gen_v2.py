# Z2H v1.3(누적 점검) + v2(랜딩·맛보기·배지·공유 카드·가입) 목업 생성기. gen.py의 공통 함수를 그대로 쓴다.
exec(open(__file__.replace('gen_v2.py','gen.py')).read())

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
<p class="cap">통과하면 04편이 열리고 "언어 모델 견습" 배지를 받습니다.</p></section>
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

EXTRA["c4_cp_result"]=""".two{display:grid;gap:var(--s5)}@media(min-width:1024px){.two{grid-template-columns:1fr 1fr;align-items:start}}.score{font-size:44px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}.lst{margin:0;padding-left:1.2em}.lst li+li{margin-top:4px}.medal{width:52px;height:52px;flex:none;border-radius:50%;border:2px solid var(--accent);background:var(--accent-tint);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-variant-numeric:tabular-nums}"""
c4='''<h1 class="t1" style="margin-bottom:var(--s5)">누적 점검 1 결과</h1>
<div class="two">
<section class="card current stack" aria-labelledby="p"><p class="kicker">통과한 경우 (예시)</p>
<h2 id="p" class="t2">✓ 누적 점검 1을 통과했습니다</h2>
<div class="row" style="gap:var(--s3)"><span class="medal" aria-hidden="true">1</span><div><b>"언어 모델 견습" 배지를 받았습니다</b><span class="cap" style="display:block">누적 점검 1 통과로 받는 단계 배지</span></div></div>
<p class="score">86%</p><p class="cap num">기준 80% · 힌트를 뺀 점수 · 11문항</p>
<ul class="lst small"><li>개념 6문항 중 5문항, 예측 4문항 모두, 손 과제 통과</li><li>04편 활성값·기울기·BatchNorm이 열렸습니다</li></ul>
<a class="btn primary block" href="#">04편 시작</a><a class="btn block" href="#">배지 보기</a>
<div class="next small"><b>다음:</b><span>04편 단계 1 / 18</span></div></section>
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


# ================= v1.3 추가: 준비된 코드 · 구간 전환 · 영상 없음 =================
def prepared(lines, more, note="외울 필요 없음 · 확인 문제와 재구성 과제에 나오지 않음 · 예측과 결과 비교 없음", label="준비된 코드 · 붙여넣기만"):
    return f'''<section class="prep" aria-label="{label}"><div class="prep-h"><span class="lb">{label}</span><span class="sp"></span><button class="btn sm">⧉ 복사</button><span class="cap">{note}</span></div>
<pre>{lines}</pre><div class="more">{('<button class="btn sm" aria-expanded="false">'+more+'</button>') if more else ''}<button class="btn sm" aria-expanded="false">줄별 풀이 펼치기 ▾</button></div></section>'''
EXTRA["c5_prepared"]=EXTRA["s4_practice"]+""".twoc{display:grid;gap:var(--s5)}@media(min-width:1024px){.twoc{grid-template-columns:1fr 340px;align-items:start}}"""
DD="""from graphviz import Digraph
def trace(root):
    nodes, edges = set(), set()
    def build(v):"""
c5=f'''<div class="stack">
<p class="cap">01 micrograd · <span class="num">단계 6 / 22</span> · L01-S06 · 따라 하기</p>
<h1 class="t1">계산 그래프 그림</h1>
<ol class="cells" aria-label="이 단계의 세 칸">
 <li aria-current="step"><span class="n">1</span><div><b>입력할 것</b><span class="small">준비된 코드(그림 함수)를 먼저 붙여 넣고 실행한 뒤, 새 코드 1줄 <code>draw_dot(d)</code>를 실행합니다.</span></div></li>
 <li><span class="n">2</span><div><b>보여야 하는 것</b><span class="small">a, b, c, d가 상자로, 계산 기호가 동그라미로 이어진 그림</span></div></li>
 <li><span class="n">3</span><div><b>그 뜻</b><span class="small">역전파는 이 그림을 오른쪽에서 왼쪽으로 거슬러 가는 일입니다.</span></div></li>
</ol></div>
<div class="twoc" style="margin-top:var(--s5)"><div class="stack">
{prepared(DD,"21줄 더 보기 (모두 25줄)")}
<section class="cx" aria-labelledby="nc"><div class="cx-top"><span id="nc">1 · 입력할 것: 새 코드 1줄</span><span class="sp"></span><button class="btn sm">⧉ 복사</button></div>
<div class="line open"><div class="cd"><span class="ln">1</span><span>draw_dot(d)</span></div><div class="ex">d가 만들어진 과정을 그림으로 그립니다.</div></div></section>
<section class="card stack" aria-labelledby="eo"><h2 id="eo" class="t3">2 · 보여야 하는 것</h2><p class="small">실행 전에 어떤 그림일지 적어 보세요. 점수에 들어가지 않습니다.</p><input type="text" aria-label="내 예측" placeholder="예: 상자 4개가 화살표로 이어짐"><div class="row"><button class="btn">모르겠어요</button><button class="btn primary" style="flex:1">예측 저장하고 보기</button></div></section>
</div>
<aside class="stack">{player(compact=True)}<p class="cap">이 구간은 단계 4~6이 함께 씁니다. 단계 4에서 보던 위치에서 이어 봅니다.</p>
<div class="next small"><b>다음:</b><span>단계 7 · 손으로 기울기 채우기 (긴 단계)</span></div></aside></div>'''
(OUT/"c5_prepared.html").write_text(page("c5_prepared","준비된 코드",c5,"lectures",back="강의 구간으로",wide=True))

EXTRA["c6_segments"]=""".two{display:grid;gap:var(--s6)}@media(min-width:1024px){.two{grid-template-columns:1.2fr 1fr;align-items:start}}"""
c6=f'''<div class="two"><section class="stack" aria-labelledby="a"><p class="kicker">구간이 여러 개인 단계</p>
<p class="cap">02 makemore 1 · <span class="num">단계 12 / 16</span> · L02-S12</p><h1 id="a" class="t1">원-핫과 가중치</h1>
<div class="seg" role="group" aria-label="영상 구간 3개"><button class="chip" aria-pressed="true">구간 1/3 · 1:10:01</button><button class="chip" aria-pressed="false">구간 2/3 · 1:13:53</button><button class="chip" aria-pressed="false">구간 3/3 · 1:47:49</button></div>
{player(rng="1:10:01–1:13:53",note=False)}
<div class="row"><button class="btn" disabled aria-disabled="true">이전 구간</button><button class="btn" style="flex:1">다음 구간 2/3 · 1:13:53–1:18:46</button></div>
<p class="cap">구간을 바꿔도 자동으로 재생하지 않습니다. 구간 3은 같은 영상의 뒷부분(1:47:49–1:50:18)입니다.</p></section>
<section class="stack" aria-labelledby="b"><p class="kicker">영상이 없는 단계</p>
<p class="cap">08 State of GPT · <span class="num">단계 1 / 8</span> · L08-S01</p><h1 id="b" class="t1">강연 전 예측</h1>
<div class="novid"><span>이 단계는 영상 없이 글로만 합니다. 강연은 다음 단계부터 봅니다.</span></div>
<section class="card stack"><label for="p" class="t3">ChatGPT는 인터넷 글을 읽기만 해서 질문에 답하게 되었을까요? 내 생각을 2줄로 적어 보세요.</label><textarea id="p" class="long" style="min-height:96px;font-family:var(--font-ui);font-size:16px">많이 읽어서 답하는 것 같다. 그런데 말투는 따로 배웠을 것 같다.</textarea><button class="btn primary block">저장</button><p class="cap">강연 뒤 단계 8에서 같은 질문에 다시 답하고 비교합니다. 점수는 없습니다.</p></section>
<div class="next small"><b>다음:</b><span>단계 2 · 학습 4단계 표 채우기 (영상 구간 5개)</span></div></section></div>'''
(OUT/"c6_segments.html").write_text(page("c6_segments","구간 전환과 영상 없음",c6,"lectures",back="강의 개요로",wide=True))

# ================= v2 (VALUE_CURRICULUM v1.1 기준) =================
SRC_NOTE="Andrej Karpathy의 공개 강의를 따라 하는 비공식 학습 가이드입니다. 강의 저자와 관계나 보증이 없습니다."
JOURNEY=[("00","사전 기초","8~12시간",None,"셀을 실행하고 에러를 읽는 법, 최소한의 수학(기울기, 행렬, 확률)을 숫자와 그림으로 익힙니다"),
("01","micrograd","8~12시간",22,"AI가 스스로 배우는 원리(역전파)를 작은 계산 엔진으로 직접 만들어 봅니다"),
("02","makemore 1","6~10시간",16,"글자 짝을 세는 가장 단순한 언어 모델로 내 컴퓨터가 새 이름을 지어내게 합니다"),
("03","makemore 2","5~8시간",12,"작은 신경망으로 더 그럴듯한 이름을 만들고, 모델 성적을 공정하게 재는 법을 익힙니다"),
("CP1","누적 점검 1","약 1시간",11,"01~03편을 한 번에 꺼내 봅니다"),
("04","BatchNorm","6~10시간",18,"신경망이 잘 배우고 있는지 그래프로 건강 검진하는 법을 배웁니다"),
("05","Backprop Ninja","8~12시간",13,"역전파를 손으로 끝까지 계산해 학습이 어떻게 흐르는지 확인합니다"),
("06","WaveNet","4~6시간",12,"층을 나무처럼 쌓아 더 긴 문맥을 보는 모델을 만듭니다"),
("CP2","누적 점검 2","약 1.5시간",13,"01~06편을 한 번에 꺼내 봅니다"),
("07","GPT 만들기","8~12시간",23,"ChatGPT의 뼈대인 트랜스포머를 직접 만들어 셰익스피어 흉내 글을 쓰게 합니다"),
("08","State of GPT","2~3시간",8,"AI 비서가 어떤 단계로 만들어지는지, 왜 어떤 질문 방식이 더 잘 통하는지 이해합니다"),
("09","토크나이저","8~12시간",13,"글을 토큰으로 나누는 도구를 만들어, 한국어가 더 비싸고 AI가 철자에 약한 이유를 설명합니다"),
("10","GPT-2 축소판","14~20시간",28,"GPT-2와 같은 구조를 만들고, 작게 줄인 판으로 학습 전 과정을 처음부터 끝까지 경험합니다"),
("CP3","누적 점검 3","약 2시간",16,"수료")]
EXTRA["v2_landing"]=""".hero{display:grid;gap:var(--s5);padding:var(--s6) 0 var(--s8)}
.hero h1{font-size:30px;line-height:1.35;font-weight:700;letter-spacing:-0.4px}
.cta{display:flex;gap:var(--s3);flex-wrap:wrap}
.sec{padding:var(--s8) 0;border-top:1px solid var(--line)}
.sec h2{margin-bottom:var(--s4)}
.stg{display:grid;gap:var(--s3)}
.stg .card{display:grid;gap:var(--s2)}
.stg .bm{display:flex;gap:var(--s3);align-items:center}
.stg .m{flex:none;width:44px;height:44px;border-radius:50%;border:2px solid var(--accent);background:var(--accent-tint);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
.stg ul{margin:0;padding-left:1.2em;font-size:14px;color:var(--ink-muted)}
.aud{display:grid;gap:var(--s3)}
.aud .msg{font-weight:600}
.aud dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px var(--s3);font-size:14px}.aud dt{color:var(--ink-muted)}.aud dd{margin:0}
.path{list-style:none;margin:0;padding:0}
.path li{display:grid;grid-template-columns:52px 1fr;gap:var(--s3);padding:var(--s2) 0;position:relative}
.path li::before{content:"";position:absolute;left:25px;top:0;bottom:0;width:2px;background:var(--line)}
.path .dot{position:relative;z-index:1;width:52px;height:32px;border-radius:var(--r-pill);background:var(--paper-raised);border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
.path li.cp .dot{border-style:dashed;color:var(--ink-muted)}
.path .t{font-weight:600}.path .m{font-size:13px;color:var(--ink-muted);font-variant-numeric:tabular-nums}
.ev{display:grid;gap:var(--s3)}
.mini-code{border-radius:var(--r-md);overflow:hidden;border:1px solid var(--line)}
.mini-code .r{display:grid;grid-template-columns:1fr}
.mini-code .c{background:var(--code-bg);color:var(--code-text);font-family:var(--font-code);font-size:13px;padding:8px 12px;white-space:pre-wrap;font-variant-ligatures:none}
.mini-code .e{background:var(--paper-raised);padding:8px 12px;font-size:14px;border-top:1px solid var(--line)}
@media(min-width:1024px){.hero{grid-template-columns:1.1fr 1fr;align-items:center;padding:var(--s14) 0}.hero h1{font-size:40px}.stg{grid-template-columns:repeat(4,1fr)}.aud{grid-template-columns:repeat(3,1fr)}.ev{grid-template-columns:repeat(3,1fr)}.path{columns:2;column-gap:var(--s10)}.path li{break-inside:avoid}.mini-code .r{grid-template-columns:1.1fr 1fr}.mini-code .e{border-top:0;border-left:1px solid var(--line)}}
"""
path="".join(f'<li class="{"cp" if n.startswith("CP") else ""}"><span class="dot">{n}</span><div><span class="t">{t}</span> <span class="m">· 약 {h}{f" · {k}단계" if k and not n.startswith("CP") else (f" · {k}문항" if k else "")}</span><br><span class="small">{a}</span></div></li>' for n,t,h,k,a in JOURNEY)
STAGES=[("0","첫 셀 완주","맛보기 + 00","기초 15단위 익힘 + 종합 과제",["맛보기에서 내 모델이 지은 이름 10개"]),
("1","언어 모델 견습","01~03","누적 점검 1 통과",["내 모델이 지은 이름 20개","내 손실 곡선","글자 임베딩 지도"]),
("2","신경망 정비사","04~06","누적 점검 2 통과",["고치기 전후 진단 그래프","내 WaveNet 검증 손실과 영상 기준 비교"]),
("3","GPT 제작자 (수료)","07~10","누적 점검 3 통과",["내 GPT가 쓴 셰익스피어 흉내 글","내 토크나이저가 내 문장을 자른 그림","축소판 GPT-2 결과 보고 카드"])]
stg="".join(f'<div class="card"><div class="bm"><span class="m">{n}</span><div><b>{t}</b><br><span class="cap">{r} · {c}</span></div></div><p class="cap">공유할 수 있는 결과물</p><ul>{"".join(f"<li>{o}</li>" for o in outs)}</ul></div>' for n,t,r,c,outs in STAGES)
AUD=[("AI를 업무에 쓰는 회사원","매일 쓰는 AI, 속을 한 번 직접 만들어 보면 쓰는 법이 달라집니다.","맛보기 → 00 → 01 → 02 → 07 → 08 → 09","약 40~60시간 · 주 4시간이면 약 3~4개월"),
("AI 산업을 판단해야 하는 투자자·경영자","AI 발표의 숫자를, 직접 돌려 본 사람의 눈으로 읽습니다.","맛보기 → 08 → 00 → 01 → 02 → 07 → 10","약 35~55시간 · 주 3시간이면 약 3~5개월"),
("입문 개발자","라이브러리 뒤에 숨은 신경망을, 빈 노트북에서 직접 만들어 봅니다.","맛보기(선택) → 00 → 01~10 전부","약 80~120시간 · 주 6시간이면 약 3~5개월")]
aud="".join(f'<div class="card stack"><b>{a}</b><p class="msg">"{m}"</p><dl><dt>추천 길</dt><dd>{p}</dd><dt>시간</dt><dd class="num">{t}</dd></dl></div>' for a,m,p,t in AUD)
v1=f'''<section class="hero"><div class="stack">
<h1>ChatGPT 같은 AI가 속에서 어떻게 배우고 글을 만드는지, 한 줄씩 직접 만들어 보며 이해합니다</h1>
<p class="muted">코드를 처음 보는 사람을 위해 설계했습니다. Andrej Karpathy의 공개 강의 "Neural Networks: Zero to Hero" 10편을 따라 하는 한국어 실습 가이드이고, 모든 코드 줄에 한국어 풀이가 붙습니다.</p>
<div class="cta"><a class="btn primary" href="#">30분 맛보기 시작</a><a class="btn" href="#">로그인</a></div>
<p class="cap">목표 30분 만에 내 컴퓨터가 처음 보는 이름을 지어내는 것을 직접 봅니다. 가입 없이, 설치 없이 무료 Colab에서.</p>
</div>
<div class="mini-code" aria-label="맛보기 코드 예시"><div class="r"><div class="c">P = (N + 1) / (N + 1).sum(1, keepdim=True)</div><div class="e">세기 표를 행마다 합이 1인 확률표로 바꿉니다.</div></div><div class="r"><div class="c">ix = torch.multinomial(P[ix], 1, generator=g).item()</div><div class="e">확률표에서 다음 글자를 뽑습니다.</div></div><div class="r"><div class="c">out.append(itos[ix])</div><div class="e">뽑은 글자를 붙입니다.</div></div><div class="r"><div class="c">print(''.join(out))</div><div class="e">지어낸 이름을 보여 줍니다.</div></div></div>
</section>
<section class="sec" aria-labelledby="g"><h2 id="g" class="t2">끝내면 얻는 것</h2><p class="small muted" style="margin-bottom:var(--s4)">단계마다 직접 만든 결과물이 남습니다. 배지는 앱 안의 학습 기록이며 자격증이 아닙니다.</p><div class="stg">{stg}</div>
<p class="cap" style="margin-top:var(--s4)">10편은 GPT-2와 같은 구조를 작게 줄여 전 과정을 체험합니다. 원본 규모 재현은 유료 GPU가 필요해 넣지 않았습니다.</p></section>
<section class="sec" aria-labelledby="w"><h2 id="w" class="t2">이런 분께 맞습니다</h2><div class="aud">{aud}</div><p class="cap" style="margin-top:var(--s3)">시간은 편별 예상 시간을 더한 값입니다. 길에 없는 편도 언제든 열 수 있습니다.</p></section>
<section class="sec" aria-labelledby="j"><h2 id="j" class="t2">수료까지의 길</h2><p class="small muted" style="margin-bottom:var(--s4)">사전 기초와 10편, 165단계, 누적 점검 3번. 몇 달에 걸쳐 직접 만들며 이해합니다.</p><ol class="path">{path}</ol></section>
<section class="sec" aria-labelledby="e"><h2 id="e" class="t2">코드를 처음 봐도 따라갈 수 있게</h2><div class="ev">
<div class="card stack"><b>모든 코드 줄에 한국어 풀이</b><p class="small muted">줄마다 쉬운 말 설명이 옆에 붙습니다.</p></div>
<div class="card stack"><b>4단계 힌트</b><p class="small muted">질문 힌트부터 정답 풀이까지, 필요한 만큼만 하나씩 엽니다.</p></div>
<div class="card stack"><b>어려운 곳은 잘게</b><p class="small muted">한 단계에 새 개념 하나. 어려운 편은 단계를 더 잘게 나눴습니다.</p></div>
<div class="card stack"><b>필요한 수학은 기초 모듈에서</b><p class="small muted">기울기, 행렬, 확률을 숫자와 그림으로. 진단 5문제로 시작점을 추천합니다.</p></div>
<div class="card stack"><b>잊기 전에 다시 꺼내 보는 간격 복습</b><p class="small muted">틀린 문제와 핵심 개념이 1·3·7·14·30일 간격으로 돌아옵니다.</p></div>
<div class="card stack"><b>공식 YouTube 영상을 구간별로</b><p class="small muted">앱 안에서 필요한 구간만 봅니다. 실습은 무료 Colab 또는 내 맥에서.</p></div>
</div></section>
<section class="sec stack" aria-labelledby="s"><h2 id="s" class="t2">먼저 30분만 해 보세요</h2><p class="muted">이름 3만 2천 개를 읽은 내 컴퓨터가 새 이름을 지어냅니다. 코드는 복사해 실행만 하고, 풀이를 읽기만 하면 됩니다.</p><div class="cta"><a class="btn primary" href="#">30분 맛보기 시작</a><a class="btn" href="#">로그인</a></div></section>
<footer class="sec cap">{SRC_NOTE} 영상은 공식 YouTube 플레이어로만 보여 주고 다시 올리지 않습니다. 원본 코드는 각 저장소의 라이선스를 따릅니다. · 이용약관 · 개인정보 처리방침</footer>'''
(OUT/"v2_landing.html").write_text(lpage("v2_landing","Z2H 소개",v1))

# 맛보기 단계 (T6, Colab)
EXTRA["v2_taste_step"]=""".tsteps{display:flex;gap:6px;list-style:none;padding:0;margin:0}.tsteps li{flex:1;height:6px;border-radius:3px;background:var(--paper-sunken)}.tsteps li.d{background:var(--correct)}.tsteps li.c{background:var(--accent)}
.lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.4fr 1fr;align-items:start}}
.ln2{display:grid;grid-template-columns:1fr}.ln2 .c{background:var(--code-bg);color:var(--code-text);font-family:var(--font-code);font-size:13.5px;padding:8px 14px;white-space:pre-wrap;overflow-wrap:anywhere;font-variant-ligatures:none;border-top:1px solid #262C3E}.ln2 .e{background:var(--paper-raised);padding:8px 14px;font-size:14px;border-top:1px solid var(--line)}
@media(min-width:1024px){.ln2{grid-template-columns:1.2fr 1fr}.ln2 .e{border-left:1px solid var(--line)}}
.cmp{display:flex;gap:var(--s2);flex-wrap:wrap}.cmp .btn{flex:1}"""
T6=[("for step in range(100):","100번 학습"),("    logits = W[xs]","앞 글자마다 다음 글자 점수 한 줄 꺼내기"),("    loss = F.cross_entropy(logits, ys)","정답을 얼마나 틀렸는지(손실)"),("    W.grad = None","지난번 기울기 비우기"),("    loss.backward()","손실을 줄이는 방향(기울기) 계산"),("    W.data += -50 * W.grad","그 반대 방향으로 조금 움직이기"),("    if step % 10 == 0 or step == 99:","10번마다 한 번"),("        print(step, round(loss.item(), 3))","학습 횟수와 손실을 보여 줍니다")]
tl="".join(f'<div class="ln2"><div class="c">{c}</div><div class="e">{e}</div></div>' for c,e in T6)
t1=f'''<div class="stack"><div class="row"><p class="kicker">30분 맛보기 · 가입 없이</p><span class="sp"></span><span class="cap num">6 / 8 · 약 6분</span></div>
<ol class="tsteps" aria-label="맛보기 8단계 중 6단계"><li class="d"></li><li class="d"></li><li class="d"></li><li class="d"></li><li class="d"></li><li class="c"></li><li></li><li></li></ol>
<h1 class="t1">작은 신경망 학습시키기</h1>
<p>Colab 맛보기 노트북의 6번 셀에 아래 코드를 붙여 넣고 Shift + Enter로 실행하세요. 코드를 이해할 필요는 없고, 풀이를 읽기만 하면 됩니다.</p></div>
<div class="lay" style="margin-top:var(--s5)"><div class="stack">
<section class="prep" aria-label="준비된 코드 · 붙여넣기만"><div class="prep-h"><span class="lb">준비된 코드 · 붙여넣기만</span><span class="sp"></span><button class="btn sm">⧉ 복사</button><span class="cap">맛보기 코드는 모두 붙여 넣고 실행만 합니다 · 점수와 예측 없음 · 앞 10줄(데이터 준비)은 "앞부분 보기"</span></div>
<div class="more" style="padding-top:0"><button class="btn sm" aria-expanded="false">앞부분 10줄 보기</button></div>{tl}</section>
<a class="btn block" href="#">Colab 맛보기 노트북 다시 열기 ↗</a>
</div>
<aside class="stack"><section class="card stack" aria-labelledby="ex"><h2 id="ex" class="t3">보여야 하는 것</h2><pre class="out" style="margin:0">0 3.8...
10 2.9...
...
99 2.5 근처</pre><p class="small">손실 숫자가 약 3.8에서 2.5 근처로 내려가는 줄들. 숫자는 환경에 따라 조금 다를 수 있습니다.</p>
<p class="small"><b>깨달음 한 줄:</b> 컴퓨터가 스스로 숫자를 고쳐 틀린 정도를 줄입니다. 이것이 "학습"입니다.</p>
<p class="small" style="font-weight:600">내 화면도 이렇게 나왔나요?</p><div class="cmp"><button class="btn">비슷해요</button><button class="btn">달라요</button></div></section>
<section class="card stack"><h2 class="t3">막혔나요?</h2><button class="btn block">1단계 힌트 열기</button><p class="cap">맛보기는 점수가 없습니다. 빨간 에러가 나오면 마지막 줄을 붙여 넣으면 읽는 법을 알려 드립니다.</p></section>
<div class="next small"><b>다음:</b><span>7 / 8 · 학습한 신경망으로 이름 뽑기 (약 3분)</span></div></aside></div>'''
(OUT/"v2_taste_step.html").write_text(lpage("v2_taste_step","30분 맛보기",t1,right='<a class="btn ghost sm" href="#">로그인</a>'))

NAMES10="gsli  di  kenah  dajamoo  krior  ari  ay\nallayulyienorikan  sjjarenvaiaimi  onnnnny"
EXTRA["v2_taste_done"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.2fr 1fr;align-items:start}}.did{margin:0;padding-left:1.2em}.did li+li{margin-top:6px}.res{font-family:var(--font-code);font-size:15px;background:var(--code-bg);color:var(--code-text);border-radius:var(--r-md);padding:var(--s4);white-space:pre-wrap;font-variant-ligatures:none;margin:0}"""
t2=f'''<div class="lay"><section class="card current stack" aria-labelledby="d"><p class="kicker">맛보기 8 / 8 · 정리</p>
<h1 id="d" class="t1">✓ 내 컴퓨터가 처음 보는 이름을 지어냈습니다</h1>
<span class="badge ok" style="align-self:flex-start">맛보기 완료</span>
<h2 class="t3">오늘 한 일</h2>
<ol class="did"><li>컴퓨터가 이름 3만 2천 개를 읽고, 어떤 글자 다음에 어떤 글자가 오는지 셌습니다.</li><li>세기만으로 새 이름을 지어냈습니다.</li><li>작은 신경망이 틀린 정도(손실)를 스스로 줄였습니다. 이것이 "학습"입니다.</li></ol>
<h2 class="t3">내 결과 (예시: 교사 몽키 실행 출력)</h2>
<pre class="res">손실  3.839 → 2.472
{NAMES10}</pre>
<p class="small">첫 모델이라 아직 서툴러요</p>
<p class="cap">지어낸 이름이 우연히 실제 사람 이름과 같을 수 있습니다.</p>
<h2 class="t3">다음 길</h2>
<p class="small">왜 그렇게 되는지는 00 기초(셀 실행, 확률, 경사 하강)에서 준비하고, 01편에서 "기울기"를 직접 만들고, 02편에서 오늘 한 것을 처음부터 한 줄씩 다시 만듭니다.</p>
<div class="row" style="flex-wrap:wrap"><a class="btn" href="#">진단 5문제 풀기</a><a class="btn" href="#">00 기초 보기</a></div>
<p class="cap">진단 결과와 상관없이 00과 01편은 열려 있습니다.</p></section>
<section class="card stack" aria-labelledby="s"><h2 id="s" class="t3">진도를 저장하려면 가입하세요 (선택)</h2>
<p class="small">가입하면 맛보기 완료 기록과 내 이름 10개가 계정에 남고, 휴대폰과 컴퓨터에서 이어서 할 수 있습니다.</p>
<a class="btn primary block" href="#">가입하고 이어서 하기</a><a class="btn block" href="#">이미 계정이 있어요 · 로그인</a>
<a class="btn ghost block" href="#">가입하지 않고 둘러보기</a>
<p class="cap">가입하지 않으면 맛보기 기록은 이 브라우저에만 7일 동안 남습니다.</p>
<hr class="rule"><a class="btn block" href="#">내 이름 10개로 공유 카드 만들기</a></section></div>'''
(OUT/"v2_taste_done.html").write_text(lpage("v2_taste_done","맛보기 완료",t2,right='<a class="btn ghost sm" href="#">로그인</a>'))

EXTRA["v2_auth"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1fr 1fr 1fr;align-items:start}}
.auth{max-width:420px}.or{display:flex;align-items:center;gap:var(--s3);color:var(--ink-muted);font-size:13px}.or::before,.or::after{content:"";flex:1;border-top:1px solid var(--line)}
.g{display:inline-flex;width:20px;height:20px;border-radius:50%;border:1px solid var(--line-strong);align-items:center;justify-content:center;font-size:12px;font-weight:700}
.chk{display:flex;gap:var(--s3);align-items:flex-start;min-height:44px;font-size:14px}.chk input{width:22px;height:22px;margin:2px 0 0;accent-color:var(--accent);flex:none}
.carry{display:flex;gap:var(--s3);align-items:flex-start;padding:var(--s3) var(--s4);background:var(--accent-tint);border-radius:var(--r-md);font-size:14px}
.err{border:1px solid var(--retry)!important}.errt{color:var(--retry);font-size:14px;font-weight:600}
.code6{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.code6 input{text-align:center;font-size:21px;font-weight:700;padding:8px 0;font-variant-numeric:tabular-nums}"""
a1='''<div class="lay">
<section class="card stack auth" aria-labelledby="su"><p class="kicker">가입 · 맛보기 기록 이어가기</p><h1 id="su" class="t2">진도를 저장할 계정 만들기</h1>
<div class="carry" role="status"><span>✓</span><span>맛보기 완료 기록과 내 이름 10개가 이 계정으로 옮겨집니다.</span></div>
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
<div class="card stack"><p class="errt">✕ 지금은 서버에 연결할 수 없습니다</p><p class="small">잠시 뒤 다시 시도해 주세요. 맛보기 기록은 이 브라우저에 남아 있습니다.</p><button class="btn block">다시 시도</button></div>
</section></div>'''
(OUT/"v2_auth.html").write_text(lpage("v2_auth","가입·로그인",a1,right='<a class="btn ghost sm" href="#">처음으로</a>'))

EXTRA["v2_badges"]=""".bg{display:grid;grid-template-columns:1fr;gap:var(--s3)}@media(min-width:600px){.bg{grid-template-columns:repeat(2,1fr)}}
.bd{display:flex;gap:var(--s3);align-items:center;padding:var(--s3);border:1px solid var(--line);border-radius:var(--r-lg);background:var(--paper-raised);min-height:76px}
.bd .m{flex:none;width:52px;height:52px;border-radius:50%;border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--accent);background:var(--accent-tint);font-variant-numeric:tabular-nums}
.bd.no{background:var(--paper)}.bd.no .m{border:2px dashed var(--line-strong);background:transparent;color:var(--ink-muted)}
.bd b{display:block;font-size:15px}.bd .cap{display:block}
.stamps{display:flex;flex-wrap:wrap;gap:var(--s2);list-style:none;padding:0;margin:0}
.stamps li{width:44px;height:44px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;border:2px dashed var(--line-strong);color:var(--ink-muted)}
.stamps li.on{border:2px solid var(--accent);background:var(--accent-tint);color:var(--accent)}
.lay{display:grid;gap:var(--s6)}@media(min-width:1024px){.lay{grid-template-columns:1fr 1fr;align-items:start}}
.prev img{width:100%;border-radius:var(--r-md);border:1px solid var(--line);display:block}"""
BADGES=[("0","첫 셀 완주","기초 15단위 익힘 + 종합 과제 (힌트 2단계 이하)","11월 16일 받음 (예시)"),("1","언어 모델 견습","누적 점검 1 통과 (01~03편)","아직 · 01편 익힘, 02편 진행 중"),("2","신경망 정비사","누적 점검 2 통과 (01~06편)","아직"),("3","GPT 제작자 (수료)","누적 점검 3 통과 (01~10편)","아직")]
bd="".join(f'<div class="bd {"" if "받음" in st else "no"}"><span class="m">{k}</span><div><b>{t}</b><span class="cap">{d}</span><span class="cap num">{st}</span></div></div>' for k,t,d,st in BADGES)
stamps="".join(f'<li class="{"on" if n=="01" else ""}" aria-label="{n}편 도장 {"받음" if n=="01" else "아직"}">{n}</li>' for n in ["01","02","03","04","05","06","07","08","09","10"])
b1=f'''<div class="lay"><section class="stack" aria-labelledby="b"><h1 id="b" class="t1">내 배지</h1><p class="small muted">배지는 앱 안의 학습 기록이며 자격증이 아닙니다. 단계 배지는 누적 점검을 통과하면 받습니다.</p>
<div class="row"><span class="badge ok">✓ 맛보기 완료</span><span class="cap">배지가 아닌 완료 표시</span></div>
<div class="bg">{bd}</div>
<h2 class="t3">편 도장</h2><p class="small muted">편을 익힐 때마다 그 편 도장을 받습니다. 짧은 길을 골라도 받을 수 있습니다.</p><ul class="stamps">{stamps}</ul></section>
<section class="card stack" aria-labelledby="sh"><h2 id="sh" class="t2">공유 카드 미리 보기</h2>
<div class="prev"><img src="../png/card_names.png" alt="공유 카드 미리 보기: 맛보기 완료, 내 모델이 지은 이름 10개 (예시)"></div>
<p class="small">카드에는 모델이 만든 결과물과 학습 숫자만 들어갑니다. 이메일, 실명, 기기 정보, 학습 시간은 넣지 않습니다.</p>
<div class="row"><button class="btn" style="flex:1">이미지 저장</button><button class="btn" style="flex:1">글 복사</button></div>
<button class="btn primary block" aria-describedby="xg">X에 공유</button>
<p id="xg" class="small" style="font-weight:600;margin:0">저장한 이미지를 첨부해 주세요</p>
<p class="cap">X 글쓰기 창에는 이미지가 자동으로 붙지 않습니다. X에 공유를 누르면 X의 글쓰기 창이 열리고, 올리기는 내가 직접 누릅니다. 이 앱은 자동으로 올리지 않습니다.</p></section></div>'''
(OUT/"v2_badges.html").write_text(page("v2_badges","배지와 공유",b1,"home",wide=True))

# ---- 다리 카드 (X11 닫힘, 교사 20:34) ----
EXTRA["v2_bridge"]=""".lay{display:grid;gap:var(--s5)}@media(min-width:1024px){.lay{grid-template-columns:1.4fr 1fr;align-items:start}}
.path{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:center;font-size:14px;color:var(--ink-muted)}.path .now{color:var(--accent);font-weight:700;border:2px solid var(--accent);background:var(--accent-tint);border-radius:var(--r-pill);padding:2px 10px}
.fig{border:1px solid var(--line);background:var(--paper-sunken);border-radius:var(--r-md);padding:var(--s4)}
.opts{list-style:none;margin:0;padding:0;display:grid;gap:var(--s2)}.opt{display:flex;gap:var(--s3);align-items:center;min-height:52px;padding:var(--s2) var(--s4);border:1px solid var(--line-strong);border-radius:var(--r-md);background:var(--paper-raised);width:100%;text-align:left;font:inherit;color:inherit}.opt .mk{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}.vl{display:flex;flex-direction:column;gap:var(--s2)}.vl a{min-height:44px}"""
br=f"""<div class="stack" style="margin-bottom:var(--s5)"><nav class="path" aria-label="내 길: AI를 업무에 쓰는 회사원"><span>회사원 길</span><span>02</span><span aria-hidden="true">→</span><span class="now" aria-current="step">다리 카드 03·04</span><span aria-hidden="true">→</span><span>07</span></nav>
<h1 class="t1">07편 전에: 03·04편 다리 카드</h1><p class="small muted">이 길은 03·04편을 건너뜁니다. 07편에 필요한 두 가지만 짧게 짚고 갑니다. 약 10분.</p><span class="tmp">내용은 예시 · 원본 pedagogy/bridge-cards-03-04.md 작성 중</span></div>
<div class="lay"><section class="card current stack" aria-labelledby="b1"><p class="kicker num">다리 카드 1 / 2 · 03편</p>
<h2 id="b1" class="t2">글자를 숫자 묶음으로: 임베딩</h2>
<p>컴퓨터는 글자를 그대로 다루지 못해서, 글자마다 숫자 몇 개짜리 묶음(임베딩)을 줍니다. 처음에는 아무렇게나 정한 숫자지만, 학습하면서 비슷하게 쓰이는 글자끼리 숫자도 비슷해집니다. 07편 GPT도 맨 앞에서 이 일을 합니다.</p>
<div class="fig stack"><p class="small"><b>그림 설명</b></p><p class="small">03편 끝에서 글자 27개를 숫자 2개짜리 임베딩으로 학습한 뒤 점으로 찍으면, 모음 a, e, i, o, u가 한쪽에 모여 보입니다. 아무도 모음이라고 알려 주지 않았습니다.</p></div>
<h3 class="t3">확인 문제 · 점수 없음</h3><p class="small">학습이 끝난 뒤, 글자 "a"와 숫자 묶음이 가장 비슷할 것 같은 글자는?</p>
<ul class="opts" role="radiogroup" aria-label="확인 문제 보기"><li><button class="opt" role="radio" aria-checked="false"><span class="mk">1</span><span>e</span></button></li><li><button class="opt" role="radio" aria-checked="false"><span class="mk">2</span><span>z</span></button></li><li><button class="opt" role="radio" aria-checked="false"><span class="mk">3</span><span>모르겠어요</span></button></li></ul>
<div class="row"><a class="btn primary" style="flex:1" href="#">다음 카드</a></div></section>
<aside class="stack"><section class="card stack" aria-labelledby="v"><h2 id="v" class="t3">영상으로 더 보기 (선택)</h2>
<div class="vl"><a class="btn" href="#"><span class="num">03편 0:12:19</span> · 임베딩 조회표</a><a class="btn" href="#"><span class="num">03편 1:05:27</span> · 임베딩 시각화</a></div><p class="cap">영상은 이 앱 안에서 열리고 자동으로 재생되지 않습니다.</p></section>
<section class="card stack" aria-labelledby="b2"><p class="kicker num">다리 카드 2 / 2 · 04편</p><h2 id="b2" class="t3">숫자를 고르게: 정규화</h2><p class="small">층을 지날 때마다 숫자가 너무 커지거나 작아지지 않게 고르게 맞추는 일입니다. 07편에서는 LayerNorm으로 나옵니다.</p>
<div class="vl"><a class="btn" href="#"><span class="num">04편 0:40:40</span> · BatchNorm</a></div></section>
<p class="cap">입문 개발자 길에는 이 카드가 없습니다. 03·04편을 직접 따라 하기 때문입니다.</p></aside></div>"""
(OUT/"v2_bridge.html").write_text(page("v2_bridge","다리 카드",br,"lectures",back="02편으로",wide=True))

EXTRA["card"]="""html,body{width:1200px;height:675px;overflow:hidden;background:var(--paper)}
.cardx{box-sizing:border-box;width:1200px;height:675px;padding:56px 64px;display:grid;grid-template-rows:auto 1fr auto;background:var(--paper)}
.top{display:flex;align-items:center;gap:16px}.mk{width:56px;height:56px;border-radius:50%;border:3px solid var(--accent);background:var(--accent-tint);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;font-variant-numeric:tabular-nums}
.ms{font-size:30px;font-weight:700}.sub{font-size:20px;color:var(--ink-muted)}
.out2{margin:32px 0 24px;background:var(--code-bg);color:var(--code-text);border-radius:18px;padding:28px 40px;font-family:var(--font-code);font-size:40px;line-height:1.55;font-variant-ligatures:none;white-space:pre-wrap;overflow:hidden}
.out2 .c{color:var(--code-comment);font-size:20px;display:block;margin-bottom:8px;font-family:var(--font-ui)}.out2 .n{color:var(--code-text);font-size:22px;margin:4px 0 0}
.foot{display:grid;grid-template-columns:1fr auto;gap:4px 16px;font-size:18px;color:var(--ink-muted)}.foot b{color:var(--ink);font-size:22px}.ex{grid-row:1/3;grid-column:2;align-self:center;border:1px dashed var(--line-strong);border-radius:999px;padding:2px 14px;font-size:18px}"""
def card(fn,mk,ms,sub,out,label,extra="",note=""):
    body=f'<div class="cardx"><div class="top"><span class="mk">{mk}</span><div><div class="ms">{ms}</div><div class="sub">{sub}</div></div></div><div class="out2"><span class="c">{label}</span>{out}{(chr(10)+'<span class="c n">'+note+"</span>") if note else ""}</div><div class="foot"><b>Z2H 제로 투 히어로 실습</b><span class="ex">예시</span><span>Andrej Karpathy의 공개 강의를 따라 만든 결과 (비공식){extra}</span></div></div>'
    h=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><link rel="stylesheet" href="z2h.css"><style>{EXTRA["card"]}</style></head><body>{body}</body></html>'''
    (OUT/f"{fn}.html").write_text(h)
card("card_names","✓","맛보기 완료","30분 맛보기 · 내 컴퓨터가 처음 지어낸 이름",NAMES10,"내 모델 출력 (예시: 교사 몽키 실행 출력, 실제 카드는 내 노트북 결과)"," · 지어낸 이름이 실제 사람 이름과 같을 수 있습니다",note="첫 모델이라 아직 서툴러요")
card("card_wavenet","2","신경망 정비사","06 WaveNet · 내 모델의 검증 손실",'내 검증 손실 2.03\n영상 기준 1.993',"내 학습 숫자 (예시)")
card("card_gpt","3","GPT 제작자","07 GPT 만들기 · 내 GPT가 쓴 셰익스피어 흉내 글","KING HENRY:\nWhat say you to the hour, my lord?\nThe night is gone, and we shall bear it so.","내 모델 출력 (예시, 실제 카드는 내 노트북 결과)")
print("v2 ok")
