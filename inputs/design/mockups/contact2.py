from PIL import Image, ImageDraw, ImageFont
import pathlib
B=pathlib.Path(__file__).parent; P=B/'png'
F=lambda w,s: ImageFont.truetype(str(B/f'fonts/Pretendard-{w}.otf'),s)
DW,MW,H,G=600,183,760,24
def sheet(title,names,out,cards=()):
    cellw=DW+G+MW; cols=3 if len(names)<=6 else 4; rows=-(-len(names)//cols)
    W=cols*cellw+(cols+1)*48; ch=(cellw*675//1200) if cards else 0
    HH=180+rows*(H+90)+(ch+110 if cards else 0)+40
    s=Image.new('RGB',(W,HH),'#F6F1E7'); d=ImageDraw.Draw(s)
    d.text((48,40),title,font=F('Bold',40),fill='#1E2430')
    d.text((48,100),'2026-11-16 KST · 디자이너 몽키 · 각 칸 왼쪽 데스크톱 1280px, 오른쪽 모바일 390px (위쪽 일부) · Pretendard + JetBrains Mono 실제 로딩 확인',font=F('Regular',24),fill='#565C68')
    for i,(k,label) in enumerate(names):
        c,r=i%cols,i//cols; x=48+c*(cellw+48); y=180+r*(H+90)
        d.text((x,y),label,font=F('SemiBold',28),fill='#2C4A96')
        for fn,tw,dx in ((f'{k}_d1280.png',DW,0),(f'{k}_m390.png',MW,DW+G)):
            im=Image.open(P/fn).convert('RGB'); sc=tw/im.width; im=im.resize((tw,int(im.height*sc)),Image.LANCZOS).crop((0,0,tw,min(H,int(im.height*sc))))
            s.paste(im,(x+dx,y+48)); d.rectangle((x+dx-1,y+47,x+dx+tw,y+48+im.height),outline='#DAD2C2')
    if cards:
        y=180+rows*(H+90); d.text((48,y),'공유 카드 예시 3종 (1200x675, X용) · 모두 "예시"',font=F('SemiBold',28),fill='#2C4A96')
        for i,c in enumerate(cards):
            im=Image.open(P/f'{c}.png').convert('RGB').resize((cellw,ch),Image.LANCZOS); x=48+i*(cellw+48)
            s.paste(im,(x,y+48)); d.rectangle((x-1,y+47,x+cellw,y+48+ch),outline='#DAD2C2')
    s.save(B.parent/out,optimize=True); print(out,s.size)
sheet('Z2H 목업 v2 · 랜딩 · 30분 맛보기 · 가입 · 배지와 공유 (예시 화면)',[('v2_landing','A 랜딩'),('v2_taste_step','B 맛보기 6/8 (Colab, 준비된 코드)'),('v2_taste_done','C 맛보기 8/8 정리 + 선택 가입'),('v2_auth','D 가입·로그인·오류 상태'),('v2_badges','E 배지 4 + 편 도장 + 공유 미리 보기'),('v2_bridge','F 다리 카드 B03-1 (회사원·투자자 길)'),('c7_edits','G 바뀐 줄만 보여 주기 (L01-S10, edits)')],'contact_sheet_v2.png',('card_names','card_wavenet','card_gpt'))
sheet('Z2H 목업 v1.3 · 누적 점검 · 고르기 · 모르겠어요 · 준비된 코드 · 구간 전환 · 165단계 (예시 화면)',[('c1_cp_intro','CP 안내 (CP1 11문항)'),('c2_cp_item','CP 문항 (힌트 H2까지)'),('c3_cp_hands','CP 손 과제'),('c4_cp_result','CP 결과 (통과 / 아직)'),('c5_prepared','준비된 코드 · 붙여넣기만 (L01-S06)'),('c6_segments','구간 1/3 전환 · 영상 없는 단계'),('s2_lecture','2 강의 개요 (01편 22단계, 긴 단계 표시)'),('s5_quiz','5 확인 문제 (고르기 추가)'),('s9_states','상태 (예측 칸 모르겠어요)'),('s8_basics','8 사전 기초 (자동으로 건너뛰지 않음)')],'contact_sheet_v1.3.png')
