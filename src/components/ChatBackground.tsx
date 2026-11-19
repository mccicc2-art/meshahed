"use client";

import { useEffect, useRef, useState } from "react";
import { posterUrl } from "@/core/media";
import imageLoader from "@/core/imageLoader";
import { CHAT_BG_DOODLE_OPACITY, CHAT_BG_SIDE_BLUR, CHAT_BG_SIDE_SIZE, CHAT_BG_TITLE_SIZE, CHAT_BG_TITLE_VEIL, type ChatBg } from "@/core/chatBg";

/**
 * 🆕 D-1382 — خلفيّةُ الخيط المفتوح (الويب).
 *
 * طبقةٌ ثابتةٌ خلف المحادثة لا خلفيّةُ الصفحة: الخيطُ يمرَّر في المستند كلِّه (D-767)، فطبقةٌ `fixed` تبقى
 * تحت الفقاعات أينما نزل القارئ، **ولا تمسّ بقيّةَ الصفحات**. لا تُلمس (`pointer-events-none`) ولا تُقرأ (`aria-hidden`).
 *
 * • Loopz — الرسومُ **قناعٌ** يُلوَّن بلون النصّ: صورةٌ واحدةٌ تتبع كلَّ ثيمٍ والوضعَ النهاريّ.
 * • العمل — 🆕 ملصقُه المختار كاملاً ممطوطاً لمقاس المساحة تحت الشريط العلويّ (D-1386)، فوقه غشاءٌ بلون خلفيّة الثيم: تعتيمٌ في الداكن وغسلٌ في النهاريّ.
 * • السوداء — لا شيء: خلفيّةُ الصفحة كما كانت.
 *
 * 🆕 T476 — **الصورةُ من وسيطنا لا من TMDB مباشرةً**: كانت `<img>` خاماً برابط `image.tmdb.org` فلا يُحمَّل حيث مضيفُ صور
 * TMDB محجوبٌ (جهازُ أحمد: الملصقُ لم يظهر قطّ، وظهر مكانه إطارُ صورةٍ مكسورة — خطٌّ عموديٌّ رفيعٌ وسط الخيط). بقيّةُ
 * الموقع تمرّ بمحمّل الصور (`imageLoader`: `/i/…` للصغيرة و`/_next/image` للكبيرة) فتظهر — والخلفيّةُ وحدها كانت خارجه.
 * **وعلى الحاسوب (≥١٠٢٤، لوحان) الطبقةُ بعرض عمود المحادثة وحده** (أحمد: «خل الصورة تغطي كامل المساحة»): كانت `inset-0`
 * فيتوسّط الملصقُ النافذةَ كلَّها ويدخل تحت قائمة المحادثات، والضبابُ تحت الشريط الجانبيّ. الآن تُقاس حدودُ العمود (والترويسةُ
 * الملتصقة فوقه) كما يقيس `KeyboardDock` عرضَه، والملصقُ **يغطّي** المساحةَ من رأسه (`object-cover` من الأعلى) — القصُّ من
 * أسفله لا من الوجوه. والجوّالُ كما اختير (D-1386): الملصقُ ممطوطاً لمقاس الشاشة.
 */
type Box = { left: number; width: number; top: number };

/** رابطُ المحمّل نفسِه الذي تمرّ به ملصقاتُ الموقع كلُّها */
function viaLoader(path: string, size: "w342" | "original", width: number) {
  const src = posterUrl(path, size);
  return src ? imageLoader({ src, width }) : undefined;
}
export function ChatBackground({ bg }: { bg: ChatBg }) {
  const layer = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const on = bg.k !== "plain";
  useEffect(() => {
    if (!on) return;
    const read = () => {
      const el = layer.current;
      const col = el?.parentElement;
      if (!el || !col || !window.matchMedia("(min-width: 1024px)").matches) {
        setBox(null);
        return;
      }
      const r = col.getBoundingClientRect();
      if (r.width === 0) return; // لم يُرسَم بعد — مراقبُ الحجم يعيد القراءة حين يُرسَم
      /* حافّةُ العمود الخارجيّة تمتدّ إلى حافّة الصفحة (حشوةُ `main`) فلا يبقى شريطٌ عارٍ عند طرف النافذة؛ والداخليّةُ
         تقف عند قائمة المحادثات. الخارجيّةُ يسارٌ في العربيّة ويمينٌ في الإنجليزيّة */
      const page = col.closest("main")?.getBoundingClientRect() ?? r;
      const rtl = getComputedStyle(col).direction === "rtl";
      const left = rtl ? page.left : r.left;
      const right = rtl ? r.right : page.right;
      /* الخيطُ أخو الطبقة التالي، وترويستُه الملتصقة أوّلُ أبنائه — الصورةُ تبدأ تحتها لا خلفها */
      const head = (el.nextElementSibling?.firstElementChild as HTMLElement | null)?.getBoundingClientRect();
      setBox({ left: Math.round(left), width: Math.round(right - left), top: Math.max(0, Math.round(head?.bottom ?? 0)) });
    };
    read();
    const ro = new ResizeObserver(read);
    if (layer.current?.parentElement) ro.observe(layer.current.parentElement);
    window.addEventListener("resize", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [on]);
  if (!on) return null;
  return (
    <div
      ref={layer}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={box ? { left: box.left, width: box.width, right: "auto" } : undefined}
    >
      {bg.k === "loopz" ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--foreground)",
            opacity: CHAT_BG_DOODLE_OPACITY,
            WebkitMaskImage: "url(/chat-doodle.png)",
            maskImage: "url(/chat-doodle.png)",
            WebkitMaskSize: "200px 200px",
            maskSize: "200px 200px",
            WebkitMaskRepeat: "repeat",
            maskRepeat: "repeat",
          }}
        />
      ) : (
        <>
          {box ? (
            /* 🆕 T476 — الحاسوب: الملصقُ يغطّي عمودَ المحادثة من تحت ترويسته، من رأسه — بلا جانبين مضبّبين */
            // eslint-disable-next-line @next/next/no-img-element -- طبقةٌ زخرفيّة: رابطُ المحمّل نفسُه، ولا حاجةَ لـsrcset
            <img
              src={viaLoader(bg.path, CHAT_BG_TITLE_SIZE, 1920)}
              alt=""
              className="absolute inset-x-0 bottom-0 w-full object-cover"
              style={{ top: box.top, height: `calc(100% - ${box.top}px)`, objectPosition: "50% 0%" }}
            />
          ) : (
            <>
              {/* 🆕 D-1386 — جانبا الشاشة العريضة: نسخةٌ مضبّبة — على الجوال لا تُرى لأنّ الملصقَ بعرض الشاشة */}
              {/* eslint-disable-next-line @next/next/no-img-element -- طبقةٌ مضبّبة: مقاسٌ صغيرٌ يكفي */}
              <img
                src={viaLoader(bg.path, CHAT_BG_SIDE_SIZE, 342)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: `blur(${CHAT_BG_SIDE_BLUR}px)`, transform: "scale(1.1)" }}
              />
              {/* الملصقُ كاملاً بحجمه الأصليّ، **ممطوطاً لمقاس المساحة** من تحت الشريط العلويّ إلى القاع («مطّ للمقاس») */}
              {/* eslint-disable-next-line @next/next/no-img-element -- الملصقُ الأصليّ عبر المحمّل: لا srcset لطبقةٍ زخرفيّة */}
              <img
                src={viaLoader(bg.path, CHAT_BG_TITLE_SIZE, 1200)}
                alt=""
                className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[640px] object-fill"
                style={{ top: "var(--sticky-top)", height: "calc(100% - var(--sticky-top))" }}
              />
            </>
          )}
          <div className="absolute inset-0" style={{ backgroundColor: "var(--background)", opacity: CHAT_BG_TITLE_VEIL }} />
        </>
      )}
    </div>
  );
}
