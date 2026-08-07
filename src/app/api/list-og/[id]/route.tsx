import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublicList } from "@/lib/data";
import { posterUrl } from "@/lib/media";

export const runtime = "nodejs";

/**
 * بطاقة معاينة القائمة المعلنة — ١٢٠٠×٦٣٠.
 *
 * رابطُ قائمةٍ في واتساب أو تويتر بلا هذه الصورة صندوقٌ رماديّ فارغ، وهو
 * الفرق بين رابطٍ يُفتح ورابطٍ يُتجاهَل. الملصقات نفسها هي البطاقة: خمسةٌ
 * متراكبةٌ بميلٍ خفيف تحت الاسم والوصف.
 *
 * بلا حارس تسجيل دخول عمداً — الزاحف الذي يبني المعاينة لا جلسة له.
 * و`public_list` وحدها هي المصدر، فالقائمة الخاصّة تُرجع 404 لا صورة.
 *
 * الخطّ يُقرأ من `public/` كما في بطاقة المشاركة: العربية تُرسم فعلاً بدل
 * مربّعاتٍ فارغة، والتوليد لا يتعطّل لو تعذّر الوصول لخادم خطوط.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const list = await getPublicList(id);
  if (!list) return new Response("not found", { status: 404 });

  const [arabic, latin] = await Promise.all([
    readFile(join(process.cwd(), "public/fonts/cairo-700-arabic.woff")),
    readFile(join(process.cwd(), "public/fonts/cairo-700-latin.woff")),
  ]);

  const posters = list.items
    .map((i) => posterUrl(i.poster_path, "w342"))
    .filter((p): p is string => !!p)
    .slice(0, 5);

  const owner = list.owner_nickname || (list.owner_username ? `@${list.owner_username}` : null);
  const ranked = list.kind === "ranked" || list.kind === "watch_order";

  return new ImageResponse(
    (
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 34, letterSpacing: -1 }}>Loopz</div>
          {owner && <div style={{ fontSize: 26, color: "#BDBDBD" }}>{owner}</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1000 }}>
          <div style={{ fontSize: 66, lineHeight: 1.1 }}>{list.name}</div>
          {list.subtitle && (
            <div style={{ fontSize: 30, color: "#BDBDBD", lineHeight: 1.35 }}>{list.subtitle}</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {posters.map((p, i) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  position: "relative",
                  width: 140,
                  height: 210,
                  borderRadius: 18,
                  overflow: "hidden",
                  border: "1px solid #2A2A2A",
                  background: "#1A1A1A",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" width={140} height={210} style={{ objectFit: "cover" }} />
                {ranked && (
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      bottom: 4,
                      fontSize: 44,
                      color: "#FFD200",
                    }}
                  >
                    {i + 1}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 28, color: "#BDBDBD" }}>{list.items.length}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        // عائلتان لا واحدة: المحرّك يختار خطاً واحداً لكل اسم عائلة، فلو
        // سمّيناهما باسم واحد ضاعت الأرقام والحروف اللاتينية مربّعاتٍ فارغة
        { name: "Cairo", data: arabic, weight: 700, style: "normal" },
        { name: "CairoLatin", data: latin, weight: 700, style: "normal" },
      ],
      headers: {
        // قائمةٌ معلنة تتغيّر ببطء، والزاحف يعيد الطلب كثيراً — ساعةٌ على
        // الحافة تكفي، ويعيد التحقّق في الخلفية بعدها
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    },
  );
}
