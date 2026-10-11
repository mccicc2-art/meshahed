# أنميشن فتح التطبيق (D-1350) — يولّد ملفَّيه من `S.npy`/`A.npy` (شغّل trace.py أوّلاً):
#   loopz-open-draw.webp  الشعارُ يُرسم على مساره مرّةً (٠٫٨٦ث) ثمّ يثبت — أبيضُ على شفّاف، ٥١٢×٥١٢
#   loopz-mark-xl.png     الشعارُ كاملاً بضعف الدقّة (١٠٢٤) — الطبقةُ التي تكبر وتختفي
#
# 🔑 **الحوافُّ من كِفاف الملفّ الأصليّ نفسِه لا من رسمٍ جديد**: كِفافُ `loopz-mark.png` عند نصف الشفافيّة (بدقّةٍ أقلَّ من
# البكسل) يُقسَّم عند زواياه الأربع، وكلُّ قطعةٍ تُمرَّر عليها شريحةٌ ملساء بانحرافٍ مسموحٍ ٠٫٠٥ بكسل — فيزول تموّجُ
# البكسلات عن الخطوط حين يكبر الشعار، والزوايا تبقى حادّةً في مكانها. المقيس: متوسّطُ الإزاحة عن الكِفاف ٠٫٠٤ بكسل
# وأقصاها ٠٫٤٣ عند طرفٍ واحد، ومساحةُ الحبر +٠٫٣٪. كِفافٌ بلا مساحةٍ (بكسلٌ نصفُ شفّافٍ عند طرف المدسوس) يُسقط:
# كان يُرسم خطّاً فيظهر نقطةً معزولة.
#
# يحتاج: numpy · scipy · scikit-image · opencv · Pillow.
import numpy as np, cv2
from PIL import Image
from skimage import measure
from scipy.interpolate import splprep, splev
A=np.load('A.npy'); S=np.load('S.npy'); TOT=1053.6; SOFT=5.0/TOT

def area(p): return 0.5*abs(np.dot(p[:,0],np.roll(p[:,1],1))-np.dot(p[:,1],np.roll(p[:,0],1)))
def vectorize(A,tol=0.05,span=5,ang=38):
    out=[]
    for c in measure.find_contours(A,0.5):
        p=c[:-1,::-1].copy()
        if area(p)<1.0: continue
        n=len(p); a=p-np.roll(p,span,0); b=np.roll(p,-span,0)-p
        turn=np.degrees(np.abs(np.arctan2(a[:,0]*b[:,1]-a[:,1]*b[:,0],(a*b).sum(1))))
        cand=[i for i in range(n) if turn[i]>ang and turn[i]==max(turn[(i+np.arange(-span,span+1))%n])] or [0]
        pts=[]
        for j,i0 in enumerate(cand):
            i1=cand[(j+1)%len(cand)]; idx=np.arange(i0,i1+1 if i1>i0 else i1+n+1)%n; seg=p[idx]; m=len(seg)
            if m<8: pts.append(seg[:-1]); continue
            w=np.ones(m); w[0]=w[-1]=50                      # الزاويتان تثبتان في مكانهما
            tck,_=splprep([seg[:,0],seg[:,1]],w=w,s=m*tol*tol,k=3)
            L=np.hypot(*np.diff(seg,axis=0).T).sum(); uu=np.linspace(0,1,max(8,int(L*3)))[:-1]
            pts.append(np.stack(splev(uu,tck),1))
        out.append(np.concatenate(pts))
    return out
POLYS=vectorize(A)
assert len(POLYS)==1, 'الشعارُ كِفافٌ واحد (الفاصلان يصلان الثقبين بالخارج)'

def fill(size,ss=8):
    """الشعارُ كاملاً على لوحة size×size (إطارُ الملفّ الأصليّ ٥١٢ نفسُه) — تعبئةُ مضلّعٍ بثمانية أضعاف الدقّة ثمّ تصغيرٌ بالمساحة"""
    k=size/512.0*ss; c=np.zeros((size*ss,size*ss),np.uint8)
    cv2.fillPoly(c,[np.round(((p+0.5)*k-0.5)*16).astype(np.int32) for p in POLYS],255,lineType=cv2.LINE_AA,shift=4)
    return cv2.resize(c,(size,size),interpolation=cv2.INTER_AREA).astype(np.float32)/255

ease=lambda x: 4*x**3 if x<0.5 else 1-(-2*x+2)**3/2
STEP=20; DRAW=860; HOLD=1500; SIZE=512     # ٢٠ms للإطار: ما دون ~١١ms تعامله بعضُ المفكِّكات ١٠٠ms
full=fill(SIZE)
def alpha(b):
    if b>=1: return full
    return full*np.clip((b*(1+2*SOFT)-SOFT-S)/SOFT+0.5,0,1)
frames=[]; durs=[]
n=DRAW//STEP
for i in range(n+1):
    al=alpha(ease(i/n) if i<n else 1.0)
    f=Image.new('RGBA',(SIZE,SIZE),(255,255,255,0)); f.putalpha(Image.fromarray((al*255).round().astype(np.uint8)))
    frames.append(f); durs.append(STEP if i<n else HOLD)
# loop=1: مرّةٌ واحدة — والشاشةُ لا تعتمد على ذلك (تُبدّله بالطبقة الثابتة قبل أن ينتهي الثبات)
frames[0].save('loopz-open-draw.webp',save_all=True,append_images=frames[1:],duration=durs,loop=1,lossless=True,quality=80,method=6)
xl=fill(1024)
m=Image.new('RGBA',(1024,1024),(255,255,255,0)); m.putalpha(Image.fromarray((xl*255).round().astype(np.uint8))); m.save('loopz-mark-xl.png',optimize=True)
d=np.abs(fill(512)-A); print('frames',len(frames),'| vs original: mean %.5f, pixels off by >0.25: %d'%(d.mean(),(d>0.25).sum()),'| ink area ratio %.4f'%(fill(512).sum()/A.sum()))
