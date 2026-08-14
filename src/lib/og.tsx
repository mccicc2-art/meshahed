import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * **بطاقةُ مشاركةٍ واحدة لصفحات الخيوط** — ذيلُ D-221.
 *
 * ================= لماذا بطاقةٌ خاصّة أصلاً =================
 *
 * `app/opengraph-image.tsx` يعطي كلَّ مسارٍ في التطبيق بطاقةَ العلامة
 * نفسَها: «Loopz — Track. Watch. Remember.». **وهي الصواب لصفحةٍ لا
 * تقول شيئاً بعينه**، وهي الخطأ لصفحةٍ كلُّ سببِ وجودها **جملةٌ واحدة**:
 * خبرُ نشرةٍ، أو رأيُ إنسانٍ في عمل. **فمن شارك خيطاً يريد أن يقول ما
 * فيه، لا أن يقول «هذا تطبيقُ Loopz»** — وهو نفسُ حكمِ عنوان الصفحة في
 * D-239 («العنوانُ جملةُ الخبر نفسُها»)، **مطبَّقاً على الصورة.**
 *
 * ================= وملفٌّ واحدٌ لا ملفّان =================
 *
 * السطحان مختلفان في المصدر — نشرةٌ لها ختمُ Loopz، وتعليقٌ له صاحب —
 * **والمشترَكُ بينهما التخطيطُ كلُّه**. ولو كُتبت بطاقةُ كلِّ صفحةٍ في
 * مكانها لافترقتا في الحشو والمقاس بعد أسبوع، **وهو ما وقع بين صفَّي
 * الخطّ قبل D-232 حرفياً**. فالوصفةُ هنا، والصفحةُ تمرّر ما يخصّها.
 *
 * ⚠️ **والخطّان يُقرآن من `public/` لا من خادم خطوط** (نفسُ حكم
 * `‎/api/list-og`): الجملةُ عربيةٌ في الغالب، **وبلا خطٍّ عربيّ تُرسم
 * مربّعاتٍ فارغة** — وبطاقةٌ فيها مربّعاتٌ أسوأُ من بطاقةٍ عامّة.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** الخطّان معاً — العربيُّ أوّلاً كي يفوز على اللاتينيّ عند التداخل */
export async function ogFonts() {
  const [arabic, latin] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/cairo-700-arabic.woff")),
    readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff")),
  ]);
  return [
    { name: "Cairo", data: arabic, style: "normal" as const, weight: 700 as const },
    { name: "CairoLatin", data: latin, style: "normal" as const, weight: 700 as const },
  ];
}

/**
 * **قياسٌ يتبع الطول** — جملةُ خبرٍ من ثمان كلمات تستحقّ ٦٤px، ورأيٌ من
 * مئتي حرفٍ يخنق البطاقةَ عندها. **ولا قصَّ بثلاث نقاطٍ ما دام التصغيرُ
 * يكفي**: النصُّ المقصوص يَعِد بما لا يعطيه.
 */
function fontSize(len: number): number {
  if (len <= 60) return 62;
  if (len <= 120) return 50;
  if (len <= 200) return 40;
  return 33;
}

/**
 * بطاقةُ خيط — ١٢٠٠×٦٣٠.
 *
 * @param kicker سطرُ الهويّة الصغير فوق الجملة: «Loopz» أو اسمُ صاحب الرأي
 * @param body   الجملةُ نفسُها — هي البطاقة، والباقي إطار
 * @param work   اسمُ العمل تحتها
 * @param poster ملصقٌ مطلقُ الرابط (TMDB) أو `null`
 * @param badge  رقمُ التقييم إن وُجد — يُرسم نجمةً بجانب اسم العمل
 * @param rtl    اتّجاهُ الجملة، يُحسب من نصّها بـ`dirOf` لا من لغة الواجهة
 */
export function threadOgCard({
  kicker,
  body,
  work,
  poster,
  badge,
  rtl,
}: {
  kicker: string;
  body: string;
  work: string;
  poster: string | null;
  badge?: string | null;
  rtl: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#0D0D0D",
        color: "#FFFFFF",
        fontFamily: "Cairo, CairoLatin",
        /* ⚠️ **`direction` لا `textAlign` وحدها**: المحرّكُ هنا satori لا
           متصفّح، **وبلا `direction` يقلب ترتيبَ كلماتِ السطر الثاني**
           حين تلتفّ الجملةُ العربية — فُحص حيّاً على رأيٍ من سطرين. */
        direction: rtl ? "rtl" : "ltr",
      }}
    >
      {/* هالةٌ خفيفة — نفسُ إحساسِ بطاقة الجذر فلا تبدوان من تطبيقين */}
      <div
        style={{
          position: "absolute",
          top: -120,
          left: 380,
          width: 640,
          height: 420,
          borderRadius: 420,
          background: "radial-gradient(circle, rgba(255,210,0,0.14), rgba(13,13,13,0) 70%)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 34, letterSpacing: -1, color: "#FFD200" }}>
          Loopz
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#BDBDBD" }}>{kicker}</div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          flexDirection: rtl ? "row-reverse" : "row",
        }}
      >
        {poster && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={poster}
            alt=""
            width={168}
            height={252}
            style={{ borderRadius: 18, border: "1px solid #2A2A2A", objectFit: "cover" }}
          />
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: 1,
            textAlign: rtl ? "right" : "left",
          }}
        >
          <div style={{ display: "flex", fontSize: fontSize(body.length), lineHeight: 1.28 }}>
            {body}
          </div>
          {(work || badge) && (
            <div
              style={{
                display: "flex",
                gap: 12,
                fontSize: 28,
                color: "#BDBDBD",
                flexDirection: rtl ? "row-reverse" : "row",
              }}
            >
              {work && <div style={{ display: "flex" }}>{work}</div>}
              {/* ⚠️ **نجمةٌ مرسومةٌ لا محرف `★`**: خطُّ Cairo لا يحمل
                  U+2605، **فيُرسم مربّعاً فارغاً** — فُحص حيّاً على بطاقة
                  تعليق. **وحرفٌ لا يملكه الخطُّ عطلٌ يراه الناسُ خارج
                  التطبيق**، فالشكلُ يُرسم لا يُستعار. */}
              {badge && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "#FFD200",
                    flexDirection: rtl ? "row-reverse" : "row",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#FFD200">
                    <path d="M12 2.4l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.5 6.1 20.6l1.2-6.6L2.5 9.4l6.6-.9z" />
                  </svg>
                  <div style={{ display: "flex" }}>{badge}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", fontSize: 24, color: "#78716C" }}>loopztv.com</div>
    </div>
  );
}
