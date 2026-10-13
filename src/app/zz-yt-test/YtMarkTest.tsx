"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * 🧪 **خمسُ طرقٍ لتشغيل المقطع نفسِه** — واحدةٌ فقط تعمل في كلِّ لحظة (مقطعان معاً على الجوّال يتنازعان الصوتَ
 * والتشغيلَ فتفسد المقارنة). **«أ» نسخةُ صفحة التريلرات اليومَ حرفاً** في المعاملات وفي القصّ (الإطارُ ثلاثةُ أضعاف
 * الصندوق — D-763)، والبقيّةُ تغيّر شيئاً واحداً كي يُعرف أيُّ تغييرٍ أخفى العلامة.
 * ⚠️ **وفوق الإطار طبقةٌ شفّافةٌ كالصفحة الحقيقيّة**: لمسةُ العضو لا تصل يوتيوب هناك، فلا تصله هنا — وإلّا قِسنا
 * علامةً تُرسم بسبب لمستنا نحن.
 */
type Variant = {
  id: string;
  title: string;
  note: string;
  host: string;
  autoplay: boolean;
  extra?: Record<string, string>;
};

const VARIANTS: Variant[] = [
  { id: "a", title: "أ — كما هو اليوم", note: "nocookie · تشغيل تلقائي صامت", host: "https://www.youtube-nocookie.com", autoplay: true },
  { id: "b", title: "ب — نطاق youtube.com", note: "مثل أ لكن من youtube.com", host: "https://www.youtube.com", autoplay: true },
  { id: "c", title: "ج — بدء بأمر بعد الجاهزية", note: "nocookie · بلا تشغيل تلقائي، ثم أمر تشغيل", host: "https://www.youtube-nocookie.com", autoplay: false },
  { id: "d", title: "د — ج من youtube.com", note: "بدء بأمر · youtube.com", host: "https://www.youtube.com", autoplay: false },
  {
    id: "e",
    title: "هـ — أ مع معاملات إضافية",
    note: "fs=0 · disablekb=1 · iv_load_policy=3",
    host: "https://www.youtube-nocookie.com",
    autoplay: true,
    extra: { fs: "0", disablekb: "1", iv_load_policy: "3" },
  },
];

const noop = () => () => {};

const STATE: Record<number, string> = { [-1]: "لم يبدأ", 0: "انتهى", 1: "يعمل", 2: "متوقّف", 3: "يحمّل", 5: "جاهز" };

function Player({ v, videoKey }: { v: Variant; videoKey: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<number | null>(null);
  const started = useRef(false);

  /* الأصلُ يُقرأ بعد التركيب لا أثناء الرسم — وإلّا اختلف `src` بين الخادم والمتصفّح (تحذيرُ ترطيب) */
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => null,
  );
  const src = (() => {
    if (!origin) return null;
    const q = new URLSearchParams({
      autoplay: v.autoplay ? "1" : "0",
      mute: "1",
      playsinline: "1",
      controls: "0",
      rel: "0",
      enablejsapi: "1",
      origin,
      ...(v.extra ?? {}),
    });
    return `${v.host}/embed/${videoKey}?${q.toString()}`;
  })();

  /* بروتوكولُ الرسائل الرسميُّ للإطار (enablejsapi): نعلن الإنصات، فيبعث الحالةَ في `infoDelivery` */
  const send = (func: string) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), v.host);

  useEffect(() => {
    const hello = window.setInterval(() => {
      frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: v.id, channel: "widget" }), v.host);
    }, 500);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== v.host || typeof e.data !== "string") return;
      let d: { event?: string; info?: { playerState?: number } } | null = null;
      try {
        d = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!d) return;
      if (d.event === "onReady" || d.event === "initialDelivery" || d.event === "infoDelivery") window.clearInterval(hello);
      /* «ج» و«د»: أوّلُ علامة جاهزيّةٍ ⇒ أمرُ التشغيل مرّةً واحدة (صامتاً كي لا يرفضه المتصفّح) */
      if (!v.autoplay && !started.current && (d.event === "onReady" || d.event === "initialDelivery")) {
        started.current = true;
        send("mute");
        send("playVideo");
      }
      const s = d.info?.playerState;
      if (typeof s === "number") setState(s);
    };
    window.addEventListener("message", onMsg);
    return () => {
      window.clearInterval(hello);
      window.removeEventListener("message", onMsg);
    };
    // المشغّلُ يُركَّب من جديد مع كلِّ طريقة (`key`) — فالمعاملات ثابتةٌ لعمره
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-card bg-black" style={{ aspectRatio: "16 / 9" }}>
        {src ? (
        <iframe
          ref={frame}
          src={src}
          title="test"
          allow="autoplay; encrypted-media; picture-in-picture"
          style={{ position: "absolute", left: 0, top: "-100%", width: "100%", height: "300%", border: 0 }}
        />
        ) : null}
        {/* الطبقةُ الشفّافة — كالصفحة الحقيقيّة، لا لمسةَ تصل يوتيوب */}
        <div className="absolute inset-0" aria-hidden />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => send("playVideo")} className="rounded-control bg-accent px-4 py-2 text-sm font-semibold text-[color:var(--on-accent)]">
          تشغيل
        </button>
        <button type="button" onClick={() => send("pauseVideo")} className="rounded-control border border-border px-4 py-2 text-sm font-semibold">
          إيقاف
        </button>
        <button type="button" onClick={() => send("unMute")} className="rounded-control border border-border px-4 py-2 text-sm font-semibold">
          صوت
        </button>
        <span className="ms-auto text-xs text-muted">الحالة: {state === null ? "—" : (STATE[state] ?? String(state))}</span>
      </div>
    </div>
  );
}

export function YtMarkTest({ videoKey }: { videoKey: string }) {
  const [pick, setPick] = useState(VARIANTS[0].id);
  const v = VARIANTS.find((x) => x.id === pick) ?? VARIANTS[0];
  return (
    <div dir="rtl" className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-bold">تجربة علامة يوتيوب (مؤقتة)</h1>
      <p className="text-sm text-muted">
        اختر طريقة، وانتظر حتى يبدأ المقطع. هل تظهر ⏸ العريضة في الوسط؟ ثم اضغط «إيقاف» ثم «تشغيل»: هل تظهر مع الاستئناف؟
      </p>
      <div className="flex flex-wrap gap-2">
        {VARIANTS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPick(x.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${x.id === pick ? "border-accent bg-accent text-[color:var(--on-accent)]" : "border-border"}`}
          >
            {x.title.split(" — ")[0]}
          </button>
        ))}
      </div>
      <div>
        <p className="font-semibold">{v.title}</p>
        <p className="text-xs text-muted">{v.note}</p>
      </div>
      <Player key={v.id} v={v} videoKey={videoKey} />
    </div>
  );
}
