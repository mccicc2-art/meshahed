# يصدّر حركةَ الشعار صورةً متحرّكةً بقناة شفافيّة (WebP) — من الخريطة نفسِها التي رُسمت منها المعاينةُ الموافَقُ عليها.
import numpy as np, sys
from PIL import Image
S=np.load('S.npy'); A=np.load('A.npy'); TOT=1053.6; SOFT=5.0/TOT
ease=lambda x: 4*x**3 if x<0.5 else 1-(-2*x+2)**3/2
DRAW,HOLD,ERASE,GAP=1500,500,1000,180; CYCLE=DRAW+HOLD+ERASE+GAP; STEP=30; N=round(CYCLE/STEP); DIM=0.14; SIZE=384
def alpha(ms):
    a=b=0.0
    if ms<DRAW: b=ease(ms/DRAW)
    elif ms<DRAW+HOLD: b=1
    elif ms<DRAW+HOLD+ERASE: a=ease((ms-DRAW-HOLD)/ERASE); b=1
    else: a=b=1
    hi=np.clip((b*(1+2*SOFT)-SOFT-S)/SOFT+0.5,0,1) if b<1 else np.ones_like(S)
    lo=np.clip((S-(a*(1+2*SOFT)-SOFT))/SOFT+0.5,0,1) if a>0 else np.ones_like(S)
    lit=hi*lo if b>a else np.zeros_like(S)
    return A*(DIM+(1-DIM)*lit)
for name,rgb in (('light',(255,255,255)),('dark',(5,5,5))):
    frames=[]
    for i in range(N):
        al=Image.fromarray((alpha(i*STEP)*255).astype(np.uint8)).resize((SIZE,SIZE),Image.LANCZOS)
        f=Image.new('RGBA',(SIZE,SIZE),rgb+(0,)); f.putalpha(al); frames.append(f)
    out=f'loopz-draw-{name}.webp'
    frames[0].save(out,save_all=True,append_images=frames[1:],duration=STEP,loop=0,lossless=True,quality=80,method=6,minimize_size=True)
    print(out,N,'frames')
