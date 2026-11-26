/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- صورةٌ يرسمها satori على الخادم: لا `next/image` ولا قارئَ شاشة */
import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { shapedText } from "@/lib/reviewCard";
import type { Locale } from "@/core/i18n";

/**
 * ====== 🆕 «حصاد 2026» — بطاقةُ القصّة (أحمد ٢٦ نوفمبر، استوديو المشاركة «ق٧أ» و«ص٦»: البطاقةُ أوّلَ ديسمبر والقصّةُ بعدها بأسبوع) ======
 *
 * **١٠٨٠×١٩٢٠** (قصصُ إنستغرام وسناب وحالةُ واتساب). **منطقةُ الأمان مرسومةٌ في التصميم**: لا نصَّ ولا شعارَ في أعلى ٢٥٠ (اسمُ
 * الحساب وشريطُ التقدّم في إنستغرام) ولا في أسفل ٣٤٠ (خانةُ الردّ) — فالرأسُ يبدأ عند ٢٦٠ والذيلُ ينتهي قبل ١٥٧٠.
 *
 * **ترتيبُها قاعدةُ بطاقات المشاركة**: الجملةُ عن صاحبها أوّلاً («محقّق الجرائم»)، ثمّ ملصقاتُ سنته، ثمّ ثلاثةُ أرقامٍ تسندها، ثمّ
 * رابطُه الشخصيّ وعلامةُ لوبز. **لا خانةَ صفر**: رقمٌ صفرٌ يسقط ولا يُرسم «0 أفلام»، والشبكةُ ثمانيةٌ أو أربعةٌ أو ما وُجد في صفٍّ
 * واحد — لا ملصقَ فارغ.
 *
 * 🔑 **كلُّ النصوص مساراتٌ مُشكَّلة** (`shapedText` بخطّي التطبيق Tajawal وPoppins): `satori` يقيس العربيّةَ حروفاً منفصلة فيخطئ
 * العرضَ والترتيب (درسُ بطاقة المراجعة T530)، فلا نصَّ خامَّ في الصورة كلِّها.
 */
export const YEAR_CARD = { width: 1080, height: 1920 };
const W = YEAR_CARD.width;
const SIDE = 72;
const INNER = W - SIDE * 2;
const Y = "#FFD400";
const FG = "#F7F7F7";
const MUTED = "#A0A0A0";
const GAP = 16;

let markP: Promise<string> | null = null;
function loopzMark(): Promise<string> {
  markP ??= readFile(join(process.cwd(), "public/loopz-mark.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return markP;
}

export type YearCardInput = {
  locale: Locale;
  year: number;
  name: string;
  username: string | null;
  avatar: string | null;
  persona: string;
  /** ملصقاتٌ جاهزةٌ (روابطُ بيانات) بترتيب الدقائق — تُقصّ هنا إلى ٨ أو ٤ */
  posters: string[];
  /** الخاناتُ بترتيب القراءة: ساعاتٌ · مسلسلاتٌ · أفلام — ما كان صفراً لا يصل */
  stats: { value: string | null; unit: string }[];
};

export async function yearCardElement(c: YearCardInput) {
  const ar = c.locale !== "en";
  const dir = ar ? "rtl" : "ltr";
  const row = ar ? "row-reverse" : "row";
  const handle = c.username ? `@${c.username}` : "";
  const link = c.username ? `loopztv.com/u/${c.username}` : "loopztv.com";
  const posters = c.posters.length >= 8 ? c.posters.slice(0, 8) : c.posters.length >= 4 ? c.posters.slice(0, 4) : c.posters;
  /* الملصقُ بمقاس شبكة الأربعة دائماً — ملصقان لا يتضخّمان حتى يبتلعا الأرقام */
  const pw = 200;
  const ph = Math.round(pw * 1.5);
  const rows = posters.length > 4 ? 2 : posters.length ? 1 : 0;
  const gridH = rows ? rows * ph + (rows - 1) * GAP : 0;
  const STATS_H = 150;
  /* الملصقاتُ والأرقامُ كتلةٌ واحدةٌ في وسط ما بين الجملة (٦٠٠) والذيل (١٤٧٠) — صفٌّ واحدٌ لا يترك فراغاً تحته */
  const blockH = gridH + (gridH ? 40 : 0) + STATS_H;
  const gridTop = Math.round(600 + Math.max(0, (850 - blockH) / 2));
  const statsTop = gridTop + gridH + (gridH ? 40 : 0);

  const [mark, nameT, handleT, tagT, leadT, personaT, linkT, loopzT, ...statT] = await Promise.all([
    loopzMark(),
    shapedText(c.name, { width: 560, size: 40, lineHeight: 1.2, maxLines: 1, color: FG, dir, face: "app" }),
    /* اتّجاهُ الصفحة لا اتّجاهُ الكلمة: في العربيّة يلتصق المعرّفُ اللاتينيُّ بالصورة من اليمين كالاسم فوقه */
    handle ? shapedText(handle, { width: 560, size: 28, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular" }) : null,
    shapedText(ar ? `حصاد ${c.year}` : `${c.year} Wrapped`, { width: 230, size: 30, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular", align: "center" }),
    shapedText(ar ? "سنتي في لوبز" : "My year on Loopz", { width: INNER, size: 34, lineHeight: 1.2, maxLines: 1, color: MUTED, dir, face: "app-regular", align: "center" }),
    shapedText(c.persona, { width: INNER, size: 92, lineHeight: 1.15, maxLines: 2, color: Y, dir, face: "app", align: "center" }),
    /* الرابطُ يلتصق بالحافّة البعيدة عن علامة لوبز في اللغتين — في الإنجليزيّة يُصفّ يميناً */
    shapedText(link, { width: 620, size: 28, lineHeight: 1.2, maxLines: 1, color: MUTED, dir: ar ? "ltr" : "rtl", face: "app-regular" }),
    shapedText("Loopz", { width: 140, size: 34, lineHeight: 1.2, maxLines: 1, color: FG, dir: "ltr", face: "app" }),
    ...c.stats.flatMap((s) => [
      s.value ? shapedText(s.value, { width: INNER / 3, size: 96, lineHeight: 1.1, maxLines: 1, color: Y, dir: "ltr", face: "app", align: "center" }) : Promise.resolve(null),
      shapedText(s.unit, { width: INNER / 3, size: s.value ? 32 : 44, lineHeight: 1.2, maxLines: 1, color: s.value ? MUTED : Y, dir, face: s.value ? "app-regular" : "app", align: "center" }),
    ]),
  ]);

  const img = (t: { src: string; width: number; height: number } | null, style: Record<string, unknown> = {}) =>
    t ? <img src={t.src} width={t.width} height={t.height} style={{ display: "flex", ...style }} /> : null;

  return (
    <div style={{ width: W, height: YEAR_CARD.height, display: "flex", flexDirection: "column", backgroundColor: "#050505", position: "relative" }}>
      {/* ضوءٌ أصفرُ خافتٌ خلف الجملة — لونُ الهويّة يُقرأ في المصغَّرة */}
      <div
        style={{
          position: "absolute",
          top: 260,
          left: 0,
          width: W,
          height: 700,
          display: "flex",
          backgroundImage: "radial-gradient(ellipse 520px 300px at 50% 40%, rgba(255,212,0,0.16), rgba(5,5,5,0))",
        }}
      />
      {/* الرأس: الصورةُ والاسمُ في البداية، و«حصاد 2026» في الطرف المقابل */}
      <div style={{ position: "absolute", top: 262, left: SIDE, width: INNER, display: "flex", flexDirection: row, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 20 }}>
          <div style={{ width: 96, height: 96, borderRadius: 48, border: `4px solid ${Y}`, display: "flex", overflow: "hidden", backgroundColor: "#181818" }}>
            {c.avatar ? <img src={c.avatar} width={88} height={88} style={{ objectFit: "cover" }} /> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: ar ? "flex-end" : "flex-start" }}>
            {img(nameT)}
            {img(handleT)}
          </div>
        </div>
        {img(tagT)}
      </div>

      {/* الجملة */}
      <div style={{ position: "absolute", top: 420, left: SIDE, width: INNER, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {img(leadT)}
        {img(personaT)}
      </div>

      {/* ملصقاتُ السنة — صفّان من أربعة أو صفٌّ واحد */}
      <div style={{ position: "absolute", top: gridTop, left: SIDE, width: INNER, display: "flex", flexDirection: row, flexWrap: "wrap", justifyContent: "center", gap: GAP }}>
        {posters.map((src, i) => (
          <div key={i} style={{ width: pw, height: ph, borderRadius: 18, overflow: "hidden", display: "flex", border: "2px solid rgba(255,255,255,0.10)", backgroundColor: "#111111" }}>
            <img src={src} width={pw} height={ph} style={{ objectFit: "cover" }} />
          </div>
        ))}
      </div>

      {/* الأرقام — ثلاثُ خاناتٍ ثابتةُ العرض، وما سقط منها لا يترك فراغاً */}
      <div style={{ position: "absolute", top: statsTop, height: STATS_H, alignItems: "center", left: SIDE, width: INNER, display: "flex", flexDirection: row, justifyContent: "center" }}>
        {c.stats.map((_, i) => (
          <div key={i} style={{ width: INNER / 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            {img(statT[i * 2] ?? null)}
            {img(statT[i * 2 + 1] ?? null)}
          </div>
        ))}
      </div>

      {/* الذيل: الرابطُ الشخصيّ وعلامةُ لوبز — فوق منطقة الردّ */}
      <div style={{ position: "absolute", top: 1480, left: SIDE, width: INNER, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {ar ? (
          <>
            {img(linkT)}
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <img src={mark} width={56} height={56} />
              {img(loopzT)}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
              <img src={mark} width={56} height={56} />
              {img(loopzT)}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>{img(linkT)}</div>
          </>
        )}
      </div>
    </div>
  );
}
