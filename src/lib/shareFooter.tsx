/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import type React from "react";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shapedText } from "@/lib/reviewCard";

/**
 * ====== 🆕 ذيلُ صور المشاركة الواحد (أحمد ٢٧ نوفمبر: «اعتمد الترتيب الثاني في كل صور المشاركة» — ذيلُ البرومو) ======
 *
 * **لماذا**: كان لكلِّ بطاقةٍ ذيلُها — رابطٌ شخصيٌّ (`loopztv.com/u/…`) يساراً وعلامةٌ صغيرةٌ يميناً في الحصاد والسجلّ، و«Download
 * now!» في المراجعة، و`loopztv.com` وحده في الإحصائيات. حكمُ أحمد: **الرابطُ الشخصيُّ لا يظهر أبداً**، والذيلُ واحدٌ في كلِّ صورة:
 * أيقونةُ التطبيق وشعارُ «Loopz» في البداية · `loopztv.com` في الوسط · **وكلمةُ الحدث** مكانَ «Join now!» («سجلّ المشاهدة»،
 * «إحصائياتي»، «حصاد 2026»…) ومعها رمزُه — الصورةُ تقول من أين جاءت وماذا فيها.
 * ⚖️ **يسارٌ إلى يمين في اللغتين** كذيل البرومو: العلامةُ تُقرأ علامةً لا جملة. **والكلمةُ مسارٌ مُشكَّل** (`shapedText`) كأخواتها.
 * المقاسُ مقاسُ القصّة (١٠٨٠) و`scale` لغيرها (روابطُ المعاينة ١٢٠٠×٦٣٠).
 */
let iconP: Promise<string> | null = null;
let wordP: Promise<string> | null = null;
const asset = (f: string) => readFile(join(process.cwd(), "public", f)).then((b) => `data:image/png;base64,${b.toString("base64")}`);

const FG = "#F7F7F7";
const URL_INK = "#8A8A8A";

/**
 * 🆕 **رمزُ الحدث** (أحمد ٢٧ نوفمبر ١٤:٠٠: «حط ايقونة تناسب الحصاد ولوبز — الرمزين الموجودة حقّ حمّل الآن انضمّ الآن»): رمزا Apple
 * والويب يقولان «حمّل»، والكلمةُ هنا حدثٌ لا دعوة — فرمزٌ واحدٌ بلون التمييز يقول الحدثَ نفسَه بجوار كلمته. خطوطٌ مرسومةٌ هنا
 * (لا ملفّاتُ أيقونات التطبيق): الصورةُ تُرسم على الخادم بلونها هي.
 */
export type ShareFooterIcon = "sparkles" | "chart" | "clock" | "star" | "comment";
const Y = "#FFD400";
const ICON: Record<ShareFooterIcon, React.ReactNode> = {
  /* الحصاد: نجماتٌ ثلاث — احتفالُ السنة */
  sparkles: (
    <g>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" fill={Y} />
      <path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z" fill={Y} />
      <path d="M5 15.5l.7 1.6 1.6.7-1.6.7L5 20.1l-.7-1.6-1.6-.7 1.6-.7z" fill={Y} />
    </g>
  ),
  /* الإحصائيات والتقرير: أعمدة */
  chart: (
    <g>
      <rect x="4" y="11" width="3.6" height="9" rx="1.4" fill={Y} />
      <rect x="10.2" y="5" width="3.6" height="15" rx="1.4" fill={Y} />
      <rect x="16.4" y="8.5" width="3.6" height="11.5" rx="1.4" fill={Y} />
    </g>
  ),
  /* سجلّ المشاهدة: ساعة */
  clock: (
    <g>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke={Y} strokeWidth={2.2} />
      <path d="M12 7.2V12l3.4 2.2" fill="none" stroke={Y} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  /* المراجعة والتقييم: نجمة */
  star: <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6L2.5 9.5l6.6-.9z" fill={Y} />,
  /* النقاش: فقاعة */
  comment: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.8c-.5.4-1.4.1-1.4-.6V5.5z" fill={Y} />,
};

/**
 * `cta` كلمةُ الحدث بلغة البطاقة («سجلّ المشاهدة» · «Watch history»). الذيلُ يملأ عرضَه (`width`) بقامة `height` — والبطاقةُ تضعه
 * حيث يناسبها (فوق منطقة الردّ في القصص، وفي الشريط الأسفل في روابط المعاينة).
 */
export async function shareFooter(o: { width: number; height: number; cta: string; icon: ShareFooterIcon; scale?: number; rtl?: boolean }) {
  const k = o.scale ?? 1;
  const iconS = Math.round(72 * k);
  const wordH = Math.round(50 * k);
  const wordW = Math.round(wordH * (720 / 247));
  const [icon, word, url, cta] = await Promise.all([
    (iconP ??= asset("icon-512.png")),
    (wordP ??= asset("loopz-wordmark.png")),
    shapedText("loopztv.com", { width: Math.round(300 * k), size: Math.round(28 * k), lineHeight: 1.2, maxLines: 1, color: URL_INK, dir: "ltr", face: "app-regular", align: "center" }),
    shapedText(o.cta, { width: Math.round(380 * k), size: Math.round(34 * k), lineHeight: 1.2, maxLines: 1, color: FG, dir: o.rtl ? "rtl" : "ltr", face: "app" }),
  ]);
  return (
    <div style={{ width: o.width, height: o.height, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
      {/* الوسط: اسمُ الموقع وحدَه — لا رابطَ شخصيٌّ أبداً */}
      <div style={{ position: "absolute", left: 0, top: 0, width: o.width, height: o.height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src={url.src} width={url.width} height={url.height} />
      </div>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: Math.round(16 * k) }}>
        <img src={icon} width={iconS} height={iconS} style={{ borderRadius: Math.round(iconS * 0.22), border: `${Math.max(1, Math.round(2 * k))}px solid #2A2A2A` }} />
        <img src={word} width={wordW} height={wordH} />
      </div>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: Math.round(16 * k) }}>
        {/* الكلمةُ مقصوصةٌ إلى عرضها الحقيقيّ فتلتصق بالرمزين */}
        <div style={{ width: cta.used, overflow: "hidden", display: "flex", justifyContent: o.rtl ? "flex-end" : "flex-start" }}>
          <img src={cta.src} width={cta.width} height={cta.height} style={o.rtl ? { marginLeft: cta.used - cta.width } : {}} />
        </div>
        <svg width={Math.round(40 * k)} height={Math.round(40 * k)} viewBox="0 0 24 24">
          {ICON[o.icon]}
        </svg>
      </div>
    </div>
  );
}
