import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * بطاقة المشاركة — 1200×630 تُرسم عند الطلب (D-122).
 *
 * كانت الصورة `icon-512.png`: مربّعة، فتعرضها تويتر/إكس وواتساب وتيليجرام
 * مصغّرةً في زاوية المنشور بدل أن تأخذ عرضه. البطاقة العريضة تضاعف نسبة
 * النقر من المشاركات — وهي أرخص مصدر زياراتٍ لدينا.
 *
 * تُبنى بالكود لا كملفٍ ثابت: اللون والتدرّج يتبعان نفس متغيّرات الهوية،
 * فلو تغيّرت لم تبقَ صورةٌ قديمة تكذّبها. ونصّها لاتينيّ عمداً — الخطّ
 * المُحمَّل هنا نسخة Cairo اللاتينية (`woff`)، والعربية تحتاج نسختها
 * وحجمَها، ولا داعي لتحميل الاثنين لصورةٍ فيها كلمتان.
 */
export const alt = "Loopz — Track. Watch. Remember.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0D0D0D",
          fontFamily: "Cairo",
          position: "relative",
        }}
      >
        {/* هالةٌ خفيفة خلف الاسم — نفس إحساس الخلفية في التطبيق */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 300,
            width: 600,
            height: 400,
            borderRadius: 400,
            background: "radial-gradient(circle, rgba(255,210,0,0.16), rgba(13,13,13,0) 70%)",
          }}
        />
        <div
          style={{
            fontSize: 132,
            letterSpacing: -4,
            backgroundImage: "linear-gradient(90deg, #ffd200, #fbbf24 55%, #f59e0b)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          Loopz
        </div>
        <div style={{ fontSize: 40, color: "#e7e5e4", marginTop: 6, display: "flex" }}>
          Track. Watch. Remember.
        </div>
        <div style={{ fontSize: 26, color: "#a8a29e", marginTop: 34, display: "flex" }}>
          Shows · Movies · Anime — all in one place
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            fontSize: 24,
            color: "#78716c",
            display: "flex",
          }}
        >
          loopztv.com
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Cairo", data: font, style: "normal", weight: 700 }],
    },
  );
}
