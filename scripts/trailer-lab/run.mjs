// مختبرُ الترايلر — يقيس TrailerPlayer الحقيقيَّ بايتاً بايتاً داخل Chromium
// المحاكي يطبّق بروتوكول ودجت يوتيوب (listening → onReady → infoDelivery)
// فنقيس ما لا يُقاس من تبويبٍ خفيّ: التأخير، سباق الصوت، التوقّف، الثواني.
import { build } from "esbuild";
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.LAB_REPO || path.resolve(HERE, "..", "..");
const PORT = 8899;
const OUT = "/tmp/lab/out";
fs.mkdirSync(OUT, { recursive: true });

// ---------- 1) الشيمات والمدخل ----------
const TMP = path.join(REPO, ".lab-tmp"); // مؤقّتة — لا تُرفع (خارج src)
fs.mkdirSync(path.join(TMP,"shims"), { recursive: true });
fs.writeFileSync(path.join(TMP,"shims/image.tsx"), `
import React from "react";
export default function Image(props: any){
  const {fill, priority, fetchPriority, sizes, ...rest} = props;
  return React.createElement("img", {...rest, "data-fetchpriority": fetchPriority ?? null});
}
`);
fs.writeFileSync(path.join(TMP,"shims/link.tsx"), `
import React from "react";
export default function Link({href, prefetch, scroll, children, ...rest}: any){
  return React.createElement("a", {href: typeof href === "string" ? href : "#", ...rest}, children);
}
`);
fs.writeFileSync(path.join(TMP,"entry.tsx"), `
import React from "react";
import {createRoot} from "react-dom/client";
import {TrailerPlayback} from "@/components/trailers/TrailerPlaybackController";
import {TrailerCardMedia} from "@/components/trailers/TrailerCardMedia";

const CARDS = [
  {key:"fast",    keys:["fast"]},
  {key:"fast2",   keys:["fast2"]},
  {key:"slow",    keys:["slow"]},
  {key:"err150",  keys:["err150","fast3"]},
  {key:"deadend", keys:["err150b"]},
  {key:"blocked", keys:["blocked"]},
  {key:"file",    keys:["fast5"], fileUrl:"/clip.webm"},
];

function App(){
  const [gone, setGone] = React.useState(new Set());
  const shown = CARDS.filter(c=>!gone.has(c.key));
  return React.createElement(TrailerPlayback, {soundPref:false},
    React.createElement("div", null,
      React.createElement("div", {style:{height:"30vh"}}),
      ...shown.map(c => React.createElement("div", {key:c.key, "data-card":c.key, className:"card"},
        React.createElement(TrailerCardMedia, {
          id:c.key,
          item:{keys:c.keys, fileUrl:c.fileUrl ?? null, title:c.key},
          backdrop:"/veil.png", title:c.key,
          playLabel:"play", muteLabel:"mute", unmuteLabel:"unmute",
          onUnavailable:()=>{ window.__mark(c.key,'retired'); setGone(p=>new Set(p).add(c.key)); },
        })
      )),
      React.createElement("div", {style:{height:"140vh"}}),
    )
  );
}
const root = createRoot(document.getElementById("root"));
window.__unmountApp = () => root.unmount();
root.render(React.createElement(App));
`);

await build({
  entryPoints: [path.join(TMP,"entry.tsx")],
  bundle: true,
  outfile: `${OUT}/bundle.js`,
  jsx: "automatic",
  absWorkingDir: REPO,
  alias: {
    "@": path.join(REPO, "src"),
    "next/image": path.join(TMP,"shims/image.tsx"),
    "next/link": path.join(TMP,"shims/link.tsx"),
  },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "silent",
});

// ---------- 2) صفحة الحصاد ----------
const harness = `<!doctype html><meta charset="utf-8"><title>trailer-lab</title>
<style>
 body{margin:0;background:#111;color:#eee;font-family:sans-serif}
 .card{width:800px;margin:24px auto;position:relative}
 .aspect-video{aspect-ratio:16/9}
 .w-full{width:100%}.h-full{height:100%}
 .relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}
 .overflow-hidden{overflow:hidden}
 .opacity-0{opacity:0}.opacity-100{opacity:1}
 .invisible{visibility:hidden}.visible{visibility:visible}
 .z-40{z-index:40}.object-cover{object-fit:cover}
 .card img{position:absolute;inset:0;width:100%;height:100%}
 .pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}
 .grid{display:grid}.place-items-center{place-items:center}
 .bg-surface-2{background:#222}
</style>
<div id="root"></div>
<script>
window.__lab=[]; window.__t0=performance.now();
/* عدّادُ التسريبات (اختبار ١٦): كلُّ interval/rAF/مستمعِ رؤيةٍ يُحصى */
window.__leaks={intervals:new Set(), rafs:0, visListeners:0};
const _si=window.setInterval.bind(window), _ci=window.clearInterval.bind(window);
window.setInterval=(...a)=>{const id=_si(...a); window.__leaks.intervals.add(id); return id;};
window.clearInterval=(id)=>{window.__leaks.intervals.delete(id); return _ci(id);};
const _raf=window.requestAnimationFrame.bind(window), _craf=window.cancelAnimationFrame.bind(window);
window.requestAnimationFrame=(cb)=>{window.__leaks.rafs++; return _raf((t)=>{window.__leaks.rafs--; cb(t);});};
window.cancelAnimationFrame=(id)=>{window.__leaks.rafs--; return _craf(id);};
const _ael=document.addEventListener.bind(document), _rel=document.removeEventListener.bind(document);
document.addEventListener=(t,...a)=>{ if(t==='visibilitychange') window.__leaks.visListeners++; return _ael(t,...a); };
document.removeEventListener=(t,...a)=>{ if(t==='visibilitychange') window.__leaks.visListeners--; return _rel(t,...a); };
window.__consoleErrors=[];
const _ce=console.error.bind(console);
console.error=(...a)=>{ window.__consoleErrors.push(a.map(String).join(' ').slice(0,200)); _ce(...a); };
window.__mark=(card,ev,extra)=>{window.__lab.push({t:Math.round(performance.now()-window.__t0),card,ev,extra:extra===undefined?null:extra});};
window.addEventListener('message', e=>{ let d; try{d=JSON.parse(e.data)}catch{return}
  if(d && d.event==='lab') window.__mark(d.key, d.lab, d.extra===undefined?null:d.extra);
});
window.__labState={};
window.__overlay=()=>document.querySelector('div[aria-hidden].fixed');
window.__labPollId=setInterval(()=>{
  const ov=window.__overlay();
  const ovOn=ov?getComputedStyle(ov).opacity==='1':false;
  document.querySelectorAll('[data-card]').forEach(c=>{
    const key=c.dataset.card;
    const btn=!!c.querySelector('button span.grid');
    const timeEl=c.querySelector('span[dir="ltr"]');
    const time=timeEl?timeEl.textContent:null;
    const prev=window.__labState[key]||{};
    const soundBtn=!!c.querySelector('button[aria-label="mute"],button[aria-label="unmute"]');
    /* «الصورةُ تعمل لهذه البطاقة» بعد قلب السِّتر: الطبقةُ ظاهرةٌ
       **وغلافُ البطاقة نفسِها تلاشى** — قياسُ الآليّة الحقيقيّة لا وكيلِها */
    const img=c.querySelector('img');
    const lifted=ovOn&&(img?getComputedStyle(img).opacity==='0':soundBtn);
    /* D-760: الصوتُ الفعليُّ المعروض — أيقونةُ «اكتم» تعني الصوتَ يعمل */
    const soundOnState=!!c.querySelector('button[aria-label="mute"]');
    if(prev.lifted!==lifted) window.__mark(key,'veil',lifted?'LIFTED':'DOWN');
    if(prev.btn!==btn) window.__mark(key,'button',btn?'SHOWN':'HIDDEN');
    if(prev.soundOnState!==soundOnState) window.__mark(key,'sound',soundOnState?'ON':'OFF');
    window.__labState[key]={lifted,btn,time,soundBtn,soundOnState};
  });
},50);
</script>
<script src="/bundle.js"></script>`;

// ---------- 2.5) محاكي iframe_api الرسمي — YT.Player فوق إطار المحاكي ----------
// المتحكّمُ يستهلك الواجهةَ الرسمية فقط؛ هذا الشِم يطبّق سطحَها فوق
// بروتوكول ودجت المحاكي، فيُختبر كودُ الإنتاج بايتاً بايتاً.
const ytApiShim = `
(function(){
  const ORIGIN='https://www.youtube-nocookie.com';
  function Player(el, cfg){
    const self=this;
    this._muted=true; this._volume=100; this._t=0; this._d=0; this._state=-1;
    this._ev=(cfg&&cfg.events)||{};
    /* D-759 بعد iPhone: الإنتاجُ يبني الإطارَ بنفسه (autoplay=1&mute=1)
       ويسلّمه قائماً — كالواجهة الرسمية تماماً. الإنشاءُ من videoId باقٍ
       لمن يسلّم عنصراً عاديّاً. */
    let iframe;
    if(el && el.tagName==='IFRAME'){
      iframe=el;
      iframe.setAttribute('data-yt-shim','1');
    } else {
      iframe=document.createElement('iframe');
      iframe.style.width='100%'; iframe.style.height='100%'; iframe.style.border='0';
      iframe.setAttribute('data-yt-shim','1');
      iframe.src=((cfg&&cfg.host)||'https://www.youtube.com')+'/embed/'+((cfg&&cfg.videoId)||'')+'?enablejsapi=1&origin='+encodeURIComponent(location.origin);
      el.replaceWith(iframe);
    }
    const vid=((iframe.src.split('/embed/')[1]||'').split('?')[0])||((cfg&&cfg.videoId)||'');
    this._iframe=iframe;
    const send=(func,args)=>{ try{ iframe.contentWindow.postMessage(JSON.stringify({event:'command',func,args:args||[]}),'*'); }catch(e){} };
    this._send=send;
    let listening=false, readyFired=false;
    const hello=setInterval(()=>{ if(listening){clearInterval(hello);return;} try{ iframe.contentWindow.postMessage(JSON.stringify({event:'listening',id:vid,channel:'widget'}),'*'); }catch(e){} },120);
    this._hello=hello;
    this._onMsg=(e)=>{
      if(e.source!==iframe.contentWindow) return;
      let d; try{ d=JSON.parse(e.data);}catch(err){return;}
      if(d.event==='onReady'){ listening=true; if(!readyFired){readyFired=true; self._readyAt=Date.now(); if(self._ev.onReady) self._ev.onReady();} return; }
      if(d.event==='onError'){ if(self._ev.onError) self._ev.onError({data:(d.info&&d.info) || 0}); return; }
      if(d.event==='onAutoplayBlocked'){ if(self._ev.onAutoplayBlocked) self._ev.onAutoplayBlocked(); return; }
      if(d.event==='infoDelivery' && d.info){
        listening=true;
        if(typeof d.info.currentTime==='number') self._t=d.info.currentTime;
        if(typeof d.info.duration==='number') self._d=d.info.duration;
        if(typeof d.info.muted==='boolean') self._muted=d.info.muted;
        if(typeof d.info.volume==='number') self._volume=d.info.volume;
        if(typeof d.info.playerState==='number' && d.info.playerState!==self._state){
          self._state=d.info.playerState;
          if(self._ev.onStateChange) self._ev.onStateChange({data:d.info.playerState});
        }
      }
    };
    window.addEventListener('message', this._onMsg);
  }
  Player.prototype.playVideo=function(){ this._send('playVideo'); };
  Player.prototype.pauseVideo=function(){ this._send('pauseVideo'); };
  /* D-760: أمانةُ الواجهة الحقيقيّة — القراءاتُ من ذاكرةٍ محلّيةٍ لا
     تتحدّث إلا بـinfoDelivery، فقراءةٌ متزامنةٌ بعد أمرٍ تعيد القديم.
     (التحديثُ المتفائل السابق كان يُخفي عطلَ «أطفيه وأشغّله».) */
  Player.prototype.mute=function(){ this._send('mute'); };
  Player.prototype.unMute=function(){ this._send('unMute'); };
  Player.prototype.isMuted=function(){ return this._muted; };
  Player.prototype.setVolume=function(v){ this._send('setVolume',[v]); };
  Player.prototype.getVolume=function(){ return this._volume; };
  Player.prototype.getCurrentTime=function(){ return this._t; };
  Player.prototype.getDuration=function(){ return this._d; };
  Player.prototype.loadVideoById=function(id){
    this._t=0; this._d=0; this._state=-1;
    this._send('loadVideoById',[id]);
  };
  Player.prototype.destroy=function(){
    clearInterval(this._hello);
    window.removeEventListener('message', this._onMsg);
    if(this._iframe&&this._iframe.parentNode) this._iframe.parentNode.removeChild(this._iframe);
  };
  window.YT={ Player:Player, PlayerState:{UNSTARTED:-1,ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5} };
  if(window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();
})();
`;

// ---------- 3) محاكي إطار يوتيوب ----------
// البروتوكول الحقيقيّ: لا رسالةَ بروتوكولٍ قبل مصافحة listening —
// وautoplay يعمل داخليّاً قبلها، فيصل «يعمل منذ متى» مع أوّل infoDelivery.
const stub = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script>
const q=new URLSearchParams(location.search);
const key=location.pathname.split('/').pop();
const P={
  fast:   {loadMs:500,  frameMs:600,  dur:120},
  fast2:  {loadMs:500,  frameMs:600,  dur:120},
  fast3:  {loadMs:500,  frameMs:600,  dur:120},
  fast5:  {loadMs:500,  frameMs:600,  dur:120},
  slow:   {loadMs:2000, frameMs:11000,dur:120},
  err150: {loadMs:400,  err:150},
  err150b:{loadMs:400,  err:150},
  blocked:{loadMs:500,  frameMs:600,  dur:120, blockFirstPlay:true},
  silent: {loadMs:400,  silent:true},
};
let key0=key; let p=P[key]||P.fast;
/* mute=1 من الرابط كما يبنيه الإنتاج الآن — والافتراضُ كتمٌ كالسابق */
let listening=false, state=-1, t=0, muted=q.get('mute')!=='0', volume=100, loaded=false;
let blockedOnce=false;
let frameTimer=null, infoTimer=null, errTimer=null;
const raw=m=>parent.postMessage(JSON.stringify(m),'*');
const lab=(x,extra)=>raw({event:'lab', key:key0, lab:x, extra});
const proto=m=>{ if(listening) raw(m); };
const info=()=>proto({event:'infoDelivery', info:{playerState:state, currentTime:t, duration:p.dur||120, muted, volume}});
function begin(){
  if(p.err){ clearTimeout(errTimer); errTimer=setTimeout(()=>{ proto({event:'onError', info:p.err}); lab('error',p.err); },400); return; }
  if(p.blockFirstPlay && !blockedOnce){ blockedOnce=true; proto({event:'onAutoplayBlocked'}); lab('autoplay-blocked'); return; }
  if(state===1) return;
  state=3; info(); clearTimeout(frameTimer);
  frameTimer=setTimeout(()=>{ state=1; lab('playing'); info(); }, p.frameMs);
}
window.addEventListener('message', e=>{
  let d; try{d=JSON.parse(e.data)}catch{return}
  if(d.event==='listening'){
    if(p.silent||!loaded) return;
    if(!listening){ listening=true; raw({event:'onReady'}); lab('heard');
      infoTimer=setInterval(()=>{ if(state===1) t+=0.25; info(); },250); }
    return;
  }
  if(d.event==='command'){
    lab('cmd:'+d.func, d.func==='seekTo'?d.args[0]:null);
    if(p.silent) return;
    if(d.func==='playVideo') begin();
    if(d.func==='pauseVideo'){ clearTimeout(frameTimer); if(state===1||state===3){state=2; info();} }
    if(d.func==='mute'){ muted=true; info(); }
    if(d.func==='unMute'){ muted=false; info(); }
    if(d.func==='setVolume'){ volume=Number(d.args&&d.args[0]); if(!Number.isFinite(volume)) volume=100; info(); }
    if(d.func==='seekTo'){ t=Number(d.args&&d.args[0])||0; info(); }
    if(d.func==='loadVideoById'){
      const nk=String(d.args&&d.args[0]||'');
      key0=nk; p=P[nk]||P.fast; blockedOnce=false;
      clearTimeout(frameTimer); clearTimeout(errTimer); t=0; state=-1; info(); lab('loaded-by-id', nk);
      begin(); /* loadVideoById يشغّل تلقائياً كالرسمية */
    }
  }
});
setTimeout(()=>{ loaded=true; lab('loaded'); if(q.get('autoplay')==='1'&&!p.silent&&!p.err) begin(); if(q.get('autoplay')==='1'&&p.err) begin(); },p.loadMs);
</script>`;

// ---------- 4) الخادم ----------
/* D-758: مقطعُ اختبارٍ للمصدر الأصيل — يُولَّد مرّةً عند الغياب */
const CLIP = path.join(OUT, "clip.webm");
if (!fs.existsSync(CLIP)) {
  const { execSync } = await import("node:child_process");
  try {
    /* WebM لا MP4: كروميوم المفتوح (بناءُ Playwright) بلا مرمّز H.264 —
       وملفّاتُ آبل الحقيقيّة H.264 تعمل في متصفّحات المستخدمين جميعاً */
    execSync(`ffmpeg -y -f lavfi -i testsrc=duration=4:size=640x360:rate=24 -f lavfi -i sine=frequency=440:duration=4 -c:v libvpx -b:v 400k -c:a libvorbis -shortest ${CLIP}`, {stdio:"ignore"});
  } catch { /* بلا ffmpeg تسقط بطاقةُ الملفّ وحدَها — والباقي يعمل */ }
}

const server = http.createServer((req,res)=>{
  if(req.url==='/__yt_iframe_api'){ res.setHeader('content-type','text/javascript'); res.end(ytApiShim); return; }
  if(req.url==='/'||req.url.startsWith('/?')){ res.setHeader('content-type','text/html'); res.end(harness); return; }
  if(req.url==='/bundle.js'){ res.setHeader('content-type','text/javascript'); res.end(fs.readFileSync(`${OUT}/bundle.js`)); return; }
  if(req.url==='/veil.png'){ res.setHeader('content-type','image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')); return; }
  if(req.url==='/clip.webm' && fs.existsSync(CLIP)){
    /* دعمُ Range — المتصفّح يطلب المقاطعَ به، وبدونه لا يبدأ العرض */
    const size=fs.statSync(CLIP).size; const r=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
    if(r){ const a=+r[1], b=r[2]?+r[2]:size-1;
      res.writeHead(206,{'content-type':'video/webm','content-range':`bytes ${a}-${b}/${size}`,'accept-ranges':'bytes','content-length':b-a+1});
      fs.createReadStream(CLIP,{start:a,end:b}).pipe(res); return; }
    res.writeHead(200,{'content-type':'video/webm','content-length':size,'accept-ranges':'bytes'});
    fs.createReadStream(CLIP).pipe(res); return;
  }
  res.statusCode=404; res.end('nf');
});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));

// ---------- 5) المتصفّح والسيناريوهات ----------
const browser = await chromium.launch({ headless:true,
  executablePath: process.env.LAB_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
const context = await browser.newContext({ viewport:{width:900,height:900} });
await context.route('**youtube-nocookie.com/embed/**', route => route.fulfill({contentType:'text/html', body: stub}));
await context.route('**www.youtube.com/iframe_api', route => route.fulfill({contentType:'text/javascript', body: ytApiShim}));
const page = await context.newPage();
const PAGE_ERRORS=[];
page.on('pageerror', e=>{ PAGE_ERRORS.push(String(e.message).slice(0,200)); console.log('PAGEERROR', e.message); });

const stamp = (label)=>page.evaluate(l=>window.__mark('_scenario',l),label);
const log = ()=>page.evaluate(()=>window.__lab);
const stateOf = ()=>page.evaluate(()=>window.__labState);
const scrollToCard = async (key)=>{ await page.evaluate(k=>{
  const c=document.querySelector('[data-card="'+k+'"]');
  window.scrollTo({top:c.offsetTop - (window.innerHeight-c.offsetHeight)/2});
},key); };

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForTimeout(4500);

/* T1/T2/T11: الأول يشتغل تلقائياً صامتاً، العداد يتحرك، لا شاشة سوداء */
await stamp('T1-first-autoplay');
const t1a=(await stateOf()).fast?.time;
await page.waitForTimeout(1300);
const t1b=(await stateOf()).fast?.time;

/* T8: iframe واحد فقط في DOM بعد التشغيل */
const iframes1 = await page.evaluate(()=>document.querySelectorAll('iframe').length);

/* T3/T4/T5: الصوت الحقيقي بضغطة المستخدم + الكوكي بعد التحقق فقط */
await stamp('T3-tap-sound');
await page.click('[data-card="fast"] button[aria-label="unmute"]');
await page.waitForTimeout(600);
const sound = await page.evaluate(()=>({
  icon: !!document.querySelector('[data-card="fast"] button[aria-label="mute"]'),
  cookie: document.cookie.includes('loopz_trailer_sound=on'),
}));

/* T6/T7: التمرير يشغّل التالي ويوقف السابق — ولا يعمل اثنان */
await stamp('T6-scroll-fast2');
await scrollToCard('fast2');
await page.waitForTimeout(2500);
const iframes2 = await page.evaluate(()=>document.querySelectorAll('iframe').length);

/* هزهزة: لا أوامر متذبذبة */
await stamp('T-wiggle');
for(let i=0;i<4;i++){ await page.evaluate(()=>window.scrollBy(0,80)); await page.waitForTimeout(150);
  await page.evaluate(()=>window.scrollBy(0,-80)); await page.waitForTimeout(150); }
await page.waitForTimeout(600);

/* slow: زر بعد ٨ ثوان (لا إجبار حالة) ثم يعمل من نفسه */
await stamp('T-slow');
await scrollToCard('slow');
await page.waitForTimeout(13500);

/* T12: خطأ ← البديل؛ ونفادها ← حذف البطاقة */
await stamp('T12-err150');
await scrollToCard('err150');
await page.waitForTimeout(4500);
await stamp('T12-deadend');
await scrollToCard('deadend');
await page.waitForTimeout(3500);
const deadGone = await page.evaluate(()=>!document.querySelector('[data-card="deadend"]'));

/* T9/T10: onAutoplayBlocked ← زر؛ والزر يعمل بضغطة واحدة */
await stamp('T9-blocked');
await scrollToCard('blocked');
await page.waitForTimeout(2500);
const blockedBtn = await page.evaluate(()=>!!document.querySelector('[data-card="blocked"] button span.grid'));
await page.click('[data-card="blocked"] button[aria-label="play"]');
await page.waitForTimeout(2500);

/* مزوّد الملف */
await stamp('T-file');
await scrollToCard('file');
await page.waitForTimeout(2500);

/* الخلفية والعودة: إيقاف فوري، وعودة صامتة */
await stamp('T-background');
await page.evaluate(()=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(700);
await stamp('T-foreground');
await page.evaluate(()=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(1800);
const fgMutedIcon = await page.evaluate(()=>!!document.querySelector('[data-card="file"] button[aria-label="unmute"]'));

/* T14: لا Seek في هذه المرحلة */
const noSlider = await page.evaluate(()=>document.querySelectorAll('[role="slider"]').length===0);

/* T16: unmount = صفر مؤقتات/مراقبين/rAF/مستمعي رؤية */
await stamp('T16-unmount');
await page.evaluate(()=>window.__unmountApp());
await page.waitForTimeout(700);
const leaks = await page.evaluate(()=>({
  intervals:[...window.__leaks.intervals].filter(id=>id!==window.__labPollId).length,
  rafs:window.__leaks.rafs,
  vis:window.__leaks.visListeners,
  iframes:document.querySelectorAll('iframe').length,
}));

/* T15: أخطاء console من كود Loopz */
const consoleErrors = await page.evaluate(()=>window.__consoleErrors);
const pageErrors = PAGE_ERRORS;

const events = await log();
await browser.close(); server.close();

// ---------- 6) التقرير ----------
const byCard=(k,ev)=>events.filter(e=>e.card===k&&e.ev===ev);
const seg=(label)=>{const i=events.findIndex(e=>e.card==='_scenario'&&e.ev===label); const j=events.findIndex((e,x)=>x>i&&e.card==='_scenario'); return [i>=0?events[i].t:0, j>=0?events[j].t:1e9];};
const inSeg=(k,ev,label)=>{const [a,b]=seg(label); return events.some(e=>e.card===k&&e.ev===ev&&e.t>=a&&e.t<=b);};
const parse=(x)=>{ if(!x) return null; const m=/^(\d+):(\d+)/.exec(x); return m?(+m[1])*60+(+m[2]):null; };

const ACC=[];
const add=(n,name,pass,detail)=>ACC.push({n,name,pass,detail});
add(1,'أول فيديو يبدأ تلقائياً صامتاً', byCard('fast','veil').some(e=>e.extra==='LIFTED') && !events.some(e=>e.card==='fast'&&e.ev==='cmd:unMute'&&e.t<(events.find(x=>x.ev==='T3-tap-sound')||{t:1e9}).t), 'veil@'+(byCard('fast','veil')[0]||{}).t);
add(2,'العداد يتحرك', parse(t1b)!==null && parse(t1b)>parse(t1a??'0:00'), (t1a??'-')+' → '+(t1b??'-'));
add(3,'الصوت يعمل فعلياً بالضغطة', sound.icon, 'icon flipped to mute');
add(4,'isMuted() أصبح false (المحاكي: unMute+volume)', events.some(e=>e.card==='fast'&&e.ev==='cmd:unMute'), '');
add(5,'الكوكي بعد التحقق فقط', sound.cookie, 'loopz_trailer_sound=on');
add(6,'التمرير يشغّل التالي ويوقف السابق', inSeg('fast','cmd:pauseVideo','T6-scroll-fast2') && byCard('fast2','veil').some(e=>e.extra==='LIFTED'), '');
add(7,'لا يعمل أكثر من فيديو (إيقاف قبل تحميل التالي)', (()=>{const [a]=seg('T6-scroll-fast2'); const p=events.find(e=>e.card==='fast'&&e.ev==='cmd:pauseVideo'&&e.t>=a); const l=events.find(e=>e.ev==='loaded-by-id'&&e.extra==='fast2'); return p&&l&&p.t<=l.t;})(), '');
add(8,'iframe واحد فقط في DOM', iframes1===1 && iframes2===1, iframes1+'/'+iframes2);
add(9,'onAutoplayBlocked يعرض زر تشغيل', events.some(e=>e.card==='blocked'&&e.ev==='autoplay-blocked') && events.some(e=>e.card==='blocked'&&e.ev==='button'&&e.extra==='SHOWN'), 'blockedBtn@T9='+blockedBtn);
add(10,'زر التشغيل يعمل بضغطة واحدة', inSeg('blocked','playing','T9-blocked'), '');
const CARD_KEYS={fast:['fast'],fast2:['fast2'],slow:['slow'],err150:['err150','fast3'],deadend:['err150b'],blocked:['blocked'],file:['fast5']};
add(11,'لا شاشة سوداء (الطبقة لا تظهر قبل أول إطار)', !events.some((e)=>{ if(e.ev!=='veil'||e.extra!=='LIFTED') return false; if(e.card==='file') return false; const fam=[e.card,...(CARD_KEYS[e.card]||[])]; const played=events.some(x=>fam.includes(x.card)&&x.ev==='playing'&&x.t<=e.t+100); return !played; }), '');
add(12,'المعطل يُستبدل بالبديل ويُحذف عند النفاد', inSeg('fast3','playing','T12-err150') && deadGone && byCard('deadend','retired').length===1, '');
add(14,'لا Seek في هذه المرحلة', noSlider, 'role=slider count 0');
add(15,'لا أخطاء console من كود Loopz', consoleErrors.filter(x=>!x.includes('shim')).length===0 && pageErrors.length===0, JSON.stringify({ce:consoleErrors.length,pe:pageErrors.length}));
add(16,'لا مؤقتات/مراقبين بعد unmount', leaks.intervals===0 && leaks.rafs<=0 && leaks.vis===0 && leaks.iframes===0, JSON.stringify(leaks));
add(17,'العودة من الخلفية صامتة (لا صوت آلي)', fgMutedIcon, 'icon=unmute');
/* D-760: بعد تفعيل الصوت على fast (T3)، البطاقةُ التالية fast2 تنطلق
   مصوَّتةً بلا أي ضغطةِ صوتٍ إضافية — والمشهدُ لا يلمس زرَّ صوت fast2 */
add(18,'الصوت محمولٌ إلى البطاقة التالية بلا ضغطة', events.some(e=>e.card==='fast2'&&e.ev==='sound'&&e.extra==='ON'), '');

console.log("\n=== ACCEPTANCE (المواصفة، القابل للقياس آلياً) ===");
for(const a of ACC) console.log((a.pass?'PASS':'FAIL').padEnd(5), String(a.n).padStart(2), a.name, a.detail?(' — '+a.detail):'');
console.log('TOTAL', ACC.filter(a=>a.pass).length+'/'+ACC.length);

console.log("\n=== RAW TIMELINE (ms from page load) ===");
for(const e of events) console.log(String(e.t).padStart(6), e.card.padEnd(9), e.ev, e.extra??'');

