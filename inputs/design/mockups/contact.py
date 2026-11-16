from PIL import Image, ImageDraw, ImageFont
import pathlib
P=pathlib.Path(__file__).parent/'png'
NAMES=[('s1_home','1 홈·진도'),('s2_lecture','2 강의 개요'),('s3_segment','3 강의 구간'),('s4_practice','4 따라 하기 실습'),('s5_quiz','5 확인 문제'),('s6_hints','6 힌트 사다리'),('s7_review','7 복습'),('s8_basics','8 사전 기초'),('s9_states','빈·로딩·오류·동기화 상태'),('s10_l08','10 강연 편 단계 (L08)')]
F=lambda w,s: ImageFont.truetype(str(pathlib.Path(__file__).parent/f'fonts/Pretendard-{w}.otf'),s)
DW,MW,H,G=600,183,760,24
cellw=DW+G+MW; cols=4; rows=3
W=cols*cellw+(cols+1)*48; HH=180+rows*(H+90)+40
sheet=Image.new('RGB',(W,HH),'#F6F1E7'); d=ImageDraw.Draw(sheet)
d.text((48,40),'Z2H 학습앱 UX/UI 목업 v1.2 · 예시 화면 (내용은 예시)',font=F('Bold',40),fill='#1E2430')
d.text((48,100),'2026-11-16 KST · 디자이너 몽키 · 각 칸 왼쪽 데스크톱 1280px, 오른쪽 모바일 390px · Pretendard + JetBrains Mono 실제 로딩 확인',font=F('Regular',24),fill='#565C68')
for i,(k,label) in enumerate(NAMES):
    c,r=i%cols,i//cols; x=48+c*(cellw+48); y=180+r*(H+90)
    d.text((x,y),label,font=F('SemiBold',28),fill='#2C4A96')
    for fn,tw,dx in ((f'{k}_d1280.png',DW,0),(f'{k}_m390.png',MW,DW+G)):
        im=Image.open(P/fn).convert('RGB'); sc=tw/im.width; im=im.resize((tw,int(im.height*sc)),Image.LANCZOS).crop((0,0,tw,min(H,int(im.height*sc))))
        sheet.paste(im,(x+dx,y+48)); d.rectangle((x+dx-1,y+47,x+dx+tw,y+48+im.height),outline='#DAD2C2')
sheet.save(pathlib.Path(__file__).parent.parent/'contact_sheet.png',optimize=True); print(sheet.size)
