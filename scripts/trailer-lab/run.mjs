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
import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {TrailerPlayer} from "@/components/TrailerPlayer";

const CARDS = [
  {key:"fast",   keys:["fast"]},
  {key:"fast2",  keys:["fast2"]},
  {key:"slow",   keys:["slow"]},
  {key:"err150", keys:["err150","fast3"]},
  {key:"silent", keys:["silent"]},
  /* D-758: المصدرُ الأصيل — ملفُّ MP4 محلّيٌّ من خادم المختبر نفسِه */
  {key:"file",   keys:["fast5"], fileUrl:"/clip.webm"},
];

function App(){
  const [muted, setMuted] = useState(false); // الصوتُ مفعَّل — لاختبار سباق الصوت والصورة
  return React.createElement("div", null,
    React.createElement("div", {style:{height:"30vh"}}),
    ...CARDS.map(c => React.createElement("div", {key:c.key, "data-card":c.key, className:"card"},
      React.createElement(TrailerPlayer, {
        videoKey:c.keys[0], videoKeys:c.keys, fileUrl:c.fileUrl ?? null, backdrop:null, title:c.key,
        muted, onMutedChange:setMuted,
        playLabel:"play", muteLabel:"mute", unmuteLabel:"unmute", seekLabel:"seek",
        className:"aspect-video w-full",
      })
    )),
    React.createElement("div", {style:{height:"140vh"}}),
  );
}
createRoot(document.getElementById("root")!).render(React.createElement(App));
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
 .pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}
 .grid{display:grid}.place-items-center{place-items:center}
 .bg-surface-2{background:#222}
</style>
<div id="root"></div>
<script>
window.__lab=[]; window.__t0=performance.now();
window.__mark=(card,ev,extra)=>{window.__lab.push({t:Math.round(performance.now()-window.__t0),card,ev,extra:extra===undefined?null:extra});};
window.addEventListener('message', e=>{ let d; try{d=JSON.parse(e.data)}catch{return}
  if(d && d.event==='lab') window.__mark(d.key, d.lab, d.extra===undefined?null:d.extra);
});
window.__labState={};
setInterval(()=>{
  document.querySelectorAll('[data-card]').forEach(c=>{
    const key=c.dataset.card;
    const veil=c.querySelector('div.transition-opacity');
    const lifted=veil?veil.classList.contains('opacity-0'):null;
    const btn=!!c.querySelector('button span.grid');
    const v=c.querySelector('video');
    if(v && !v.__labHooked){ v.__labHooked=true;
      v.addEventListener('playing',()=>window.__mark(key,'native-playing',null));
      v.addEventListener('error',()=>window.__mark(key,'native-error',null)); }
    const timeEl=c.querySelector('span[dir="ltr"]');
    const time=timeEl?timeEl.textContent:null;
    const prev=window.__labState[key]||{};
    if(prev.lifted!==lifted) window.__mark(key,'veil',lifted?'LIFTED':'DOWN');
    if(prev.btn!==btn) window.__mark(key,'button',btn?'SHOWN':'HIDDEN');
    window.__labState[key]={lifted,btn,time};
  });
},50);
</script>
<script src="/bundle.js"></script>`;

// ---------- 3) محاكي إطار يوتيوب ----------
// البروتوكول الحقيقيّ: لا رسالةَ بروتوكولٍ قبل مصافحة listening —
// وautoplay يعمل داخليّاً قبلها، فيصل «يعمل منذ متى» مع أوّل infoDelivery.
const stub = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<script>
const q=new URLSearchParams(location.search);
const key=location.pathname.split('/').pop();
const P={
  fast:  {loadMs:500,  frameMs:600,  dur:120},
  fast2: {loadMs:500,  frameMs:600,  dur:120},
  fast3: {loadMs:500,  frameMs:600,  dur:120},
  slow:  {loadMs:2000, frameMs:11000,dur:120},
  err150:{loadMs:400,  err:150},
  silent:{loadMs:400,  silent:true},
};
const p=P[key]||P.fast;
let listening=false, state=-1, t=0, muted=q.get('mute')==='1', loaded=false;
let frameTimer=null, infoTimer=null;
const raw=m=>parent.postMessage(JSON.stringify(m),'*');
const lab=(x,extra)=>raw({event:'lab', key, lab:x, extra});
const proto=m=>{ if(listening) raw(m); };
const info=()=>proto({event:'infoDelivery', info:{playerState:state, currentTime:t, duration:p.dur||120, muted}});
function begin(){
  if(p.err){ setTimeout(()=>{ proto({event:'onError', info:p.err}); lab('error',p.err); },400); return; }
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
    if(d.func==='mute') muted=true;
    if(d.func==='unMute') muted=false;
    if(d.func==='seekTo'){ t=Number(d.args&&d.args[0])||0; info(); }
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
  if(req.url==='/'||req.url.startsWith('/?')){ res.setHeader('content-type','text/html'); res.end(harness); return; }
  if(req.url==='/bundle.js'){ res.setHeader('content-type','text/javascript'); res.end(fs.readFileSync(`${OUT}/bundle.js`)); return; }
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
const page = await context.newPage();
page.on('pageerror', e=>console.log('PAGEERROR', e.message));

const stamp = (label)=>page.evaluate(l=>window.__mark('_scenario',l),label);
const log = ()=>page.evaluate(()=>window.__lab);
const stateOf = ()=>page.evaluate(()=>window.__labState);
const scrollToCard = async (key)=>{ await page.evaluate(k=>{
  const c=document.querySelector('[data-card="'+k+'"]');
  window.scrollTo({top:c.offsetTop - (window.innerHeight-c.offsetHeight)/2});
},key); };

await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForTimeout(4500);

await stamp('S2-scroll-to-fast2');
await scrollToCard('fast2');
await page.waitForTimeout(3500);

await stamp('S3-wiggle');
for(let i=0;i<4;i++){ await page.evaluate(()=>window.scrollBy(0, 80)); await page.waitForTimeout(180);
  await page.evaluate(()=>window.scrollBy(0,-80)); await page.waitForTimeout(180); }
await page.waitForTimeout(800);

await stamp('S4-scroll-to-slow');
await scrollToCard('slow');
await page.waitForTimeout(14000);

await stamp('S5-scroll-to-err150');
await scrollToCard('err150');
await page.waitForTimeout(6000);

await stamp('S6-scroll-to-silent');
await scrollToCard('silent');
await page.waitForTimeout(10500);

await stamp('S7-back-to-fast2-resume');
await scrollToCard('fast2');
await page.waitForTimeout(3000);

await stamp('S8-background');
await page.evaluate(()=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(800);
await stamp('S8-foreground');
await page.evaluate(()=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(2500);

await stamp('S10-scroll-to-file');
await scrollToCard('file');
await page.waitForTimeout(3000);
await stamp('S10-file-wiggle-back');
await scrollToCard('silent');
await page.waitForTimeout(1200);
await scrollToCard('file');
await page.waitForTimeout(2000);

await stamp('S9-tick-check-a');
const timeA = (await stateOf()).file?.time;
await page.waitForTimeout(1600);
await stamp('S9-tick-check-b');
const timeB = (await stateOf()).file?.time;

const events = await log();
await browser.close(); server.close();

// ---------- 6) التقرير ----------
console.log("=== RAW TIMELINE (ms from page load) ===");
for(const e of events) console.log(String(e.t).padStart(6), e.card.padEnd(9), e.ev, e.extra??'');
console.log("\\n=== tick check: file-card time A/B ===", JSON.stringify(timeA), JSON.stringify(timeB));
