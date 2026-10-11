# يحسب لكلِّ بكسلٍ في الشعار موضعَه على المسار (٠…١) — البارزُ أوّلاً ثمّ المدسوس — ثمّ يرسم الإطارات منه.
import numpy as np, sys
from PIL import Image
SRC='../../../../public/loopz-mark.png'  # يُشغَّل من هذا المجلّد: python3 trace.py ثمّ python3 export.py
im=Image.open(SRC).convert('RGBA'); A=np.array(im)[:,:,3].astype(np.float32)/255; H,W=A.shape
R=79.5; L=np.array([147.,255.]); Rt=np.array([362.,255.]); d=Rt[0]-L[0]; al=np.arccos(2*R/d); HALF=27.5
lt=L+R*np.array([np.cos(al),-np.sin(al)]); lb=L+R*np.array([np.cos(al),np.sin(al)])
rt=Rt+R*np.array([-np.cos(al),-np.sin(al)]); rb=Rt+R*np.array([-np.cos(al),np.sin(al)])
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
def seg(p,q):
    v=q-p; n=np.hypot(*v); u=((xx-p[0])*v[0]+(yy-p[1])*v[1])/(n*n); uc=np.clip(u,0,1)
    dist=np.hypot(xx-(p[0]+uc*v[0]),yy-(p[1]+uc*v[1])); return dist,u,n
# أيُّ القطرين هو البارز؟ الفاصلان الشفّافان يحفّان بالبارز: نعدّ الشفّافَ على بُعد نصف العرض + ٣ من كلِّ قطر
def flank(p,q):
    dist,u,n=seg(p,q); m=(dist>HALF+1)&(dist<HALF+6)&(u>0.35)&(u<0.65); return float((A[m]<0.3).mean())
fa,fb=flank(lt,rb),flank(rt,lb)
over=(lt,rb) if fa>fb else (rt,lb)
print('transparent flank share  UL-LR=%.2f  UR-LL=%.2f  -> over strand is %s'%(fa,fb,'UL-LR' if fa>fb else 'UR-LL'))
assert over[0] is lt, 'the path below assumes the over strand runs upper-left to lower-right'
arcLen=R*(2*np.pi-2*al); dO,uO,linLen=seg(lt,rb); dU,uU,_=seg(rt,lb); tot=2*arcLen+2*linLen
def arc(c,a_start,sign):
    # زاويةُ البكسل مقيسةً من بداية القوس في اتّجاه السير؛ القوسُ يغطّي 2π-2al
    ang=np.arctan2(yy-c[1],xx-c[0]); t=((ang-a_start)*sign)%(2*np.pi); span=2*np.pi-2*al
    inside=t<=span; dist=np.where(inside,np.abs(np.hypot(xx-c[0],yy-c[1])-R),1e9); return dist,t/span
# ٢) القوسُ الأيمن: من rb (أسفل يسار الحلقة اليمنى) عبر أسفلها فيمينها فأعلاها إلى rt
aR0=np.arctan2(rb[1]-Rt[1],rb[0]-Rt[0]); dR,uR=arc(Rt,aR0,-1)
# ٤) القوسُ الأيسر: من lb (أسفل يمين الحلقة اليسرى) عبر أسفلها فيسارها فأعلاها إلى lt
aL0=np.arctan2(lb[1]-L[1],lb[0]-L[0]); dL,uL=arc(L,aL0,+1)
s0,s1,s2,s3=0,linLen/tot,(linLen+arcLen)/tot,(2*linLen+arcLen)/tot
inO=(uO>=0)&(uO<=1); inU=(uU>=0)&(uU<=1)
dOe=np.where(inO,dO,1e9); dUe=np.where(inU,dU,1e9)
stack=np.stack([dOe,dR,dUe,dL]); pick=stack.argmin(0)
# 🔑 **البارزُ يُعرَّف من الصورة لا من الهندسة**: حول التقاطع يفصله عن المدسوس خطّان شفّافان — فهو المركّبةُ المتّصلةُ
# التي تحوي مركزَ الشعار داخل منطقة التقاطع. عتبةُ مسافةٍ كانت تخطئ ببكسلين (خطُّ الوسط المحسوب ليس خطَّه تماماً)
# فتترك خيطاً من حافّته يُضيء ويُمحى مع غيره. بكسلاتُ الحافّة الشفّافةُ جزئيّاً تتبع أقربَ بكسلٍ معتمٍ إليها.
from scipy import ndimage as ndi
Z=inO&(uO>0.12)&(uO<0.88)&(dO<HALF+14)
lab,_=ndi.label((A>0.5)&Z); core=lab==lab[255,255]
assert lab[255,255]>0
_,(iy,ix)=ndi.distance_transform_edt(~((A>0.5)&Z),return_indices=True)
near_over=core[iy,ix]                      # لكلِّ بكسل: هل أقربُ معتمٍ إليه في المنطقة من البارز؟
rest=np.stack([dR,dUe,dL]).argmin(0); rest=np.choose(rest,[1,2,3])
pick=np.where(Z,np.where(near_over,0,rest),pick)
S=np.choose(pick,[s0+uO*(s1-s0), s1+np.clip(uR,0,1)*(s2-s1), s2+uU*(s3-s2), s3+np.clip(uL,0,1)*(1-s3)]).astype(np.float32)
# بكسلاتُ حافّةٍ معدودةٌ قد تُنسب لغير شريطها (ثلاثةٌ هنا وأربعةٌ هناك): من خالف جيرانَه المعتمين كلَّهم يأخذ وسيطَهم
def tidy(S):
    out=S.copy(); op=A>0.02; ys,xs=np.nonzero(op)
    for y,x in zip(ys,xs):
        y0,y1,x0,x1=max(0,y-3),y+4,max(0,x-3),x+4; nb=S[y0:y1,x0:x1][op[y0:y1,x0:x1]]
        if (np.abs(nb-S[y,x])<0.06).sum()<8: out[y,x]=np.median(nb)
    return out
S=tidy(tidy(S))
# وما بقي معزولاً خلف فاصلٍ (جيرانُه في النافذة من الشريط المقابل فلم يُعدّ شاذّاً): جزيرةٌ تُضيء وحدَها في أيِّ مرحلةٍ
# تأخذ وسيطَ ما يلاصقها من شريطها
def islands(S):
    op=A>0.2; fixed=0
    for b in np.linspace(0.01,0.99,197):
        for m in ((S<=b)&op,(S>b)&op):
            lab,n=ndi.label(m,structure=np.ones((3,3))); sizes=np.bincount(lab.ravel())[1:]
            for k in np.nonzero(sizes<30)[0]:
                isl=lab==k+1; ring=ndi.binary_dilation(isl,iterations=2)&op&~isl
                if ring.any(): S[isl]=np.median(S[ring]); fixed+=1
    return fixed
for _ in range(3):
    if not islands(S): break
# 🔴 D-1350 — **كلُّ بكسل حافّةٍ يتبع أقربَ حبرٍ معتمٍ إليه**: بكسلاتٌ نصفُ شفّافةٍ عند طرف المدسوس (قرب ٣١٥،٢٧٨)
# كانت منسوبةً للبارز، فتضيء معه وتبقى نقطةً معزولةً حتى يصلها شريطُها (نحو ٤٠٪ من مدّة الرسم عند العرض بدقّةٍ
# أعلى، ومرحلتان من ١٩٧ بدقّة هذا الملفّ). الفحصُ السابق (`islands`) يقرأ الحبرَ فوق ٠٫٢ فلم يرَها.
_,(iy,ix)=ndi.distance_transform_edt(~(A>0.5),return_indices=True); S=S[iy,ix]
np.save('S.npy',S); np.save('A.npy',A)
chk=Image.fromarray((np.dstack([S*255,(pick*60),A*255*0+80,A*255])).astype(np.uint8),'RGBA'); chk.save('param-check.png')
print('lengths: line %.1f arc %.1f; breakpoints %.3f %.3f %.3f'%(linLen,arcLen,s1,s2,s3))
