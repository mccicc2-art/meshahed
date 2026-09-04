import { ImageResponse } from "next/og";
import { getNewsPost } from "@/lib/data";
import { newsLine } from "@/core/newsLine";
import { posterUrl } from "@/core/media";
import { dirOf } from "@/core/dir";
import { getT } from "@/lib/locale";
import { OG_SIZE, OG_CONTENT_TYPE, ogFonts, threadOgCard } from "@/lib/og";

/**
 * **بطاقةُ مشاركةِ نشرة Loopz** — ذيلُ D-221.
 *
 * **الجملةُ هي البطاقة**: نفسُ `newsLine` التي تُرسم في الصفحة وفي الخطّ،
 * **فما يراه المستلمُ في واتساب هو ما سيجده حين يفتح** — ولا صيغةَ ثانيةً
 * للخبر تُكتب هنا فتفترق عن الأولى بعد أسبوع.
 *
 * **وسقوطُها يعود إلى بطاقة الجذر لا إلى خطأ**: `notFound` هنا يجعل
 * الكاشطَ يلتقط `app/opengraph-image.tsx` الموروثة — **بطاقةٌ عامّةٌ خيرٌ
 * من مربّعٍ رمادي.**
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Loopz";

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { locale, t } = await getT();
  const post = await getNewsPost(decodeURIComponent(key)).catch(() => null);
  const line = post ? newsLine(post, t, locale) : null;
  if (!post || !line) return new Response("not found", { status: 404 });

  return new ImageResponse(
    threadOgCard({
      kicker: post.media_type === "tv" ? t.typeSeries : t.typeMovie,
      body: line,
      work: post.title ?? "",
      poster: posterUrl(post.poster_path, "w342"),
      rtl: dirOf(line) === "rtl",
    }),
    { ...size, fonts: await ogFonts() },
  );
}
