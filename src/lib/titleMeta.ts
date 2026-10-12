import type { Metadata } from "next";

/**
 * ====== بطاقةُ معاينة العمل (🆕 D-1374 — قرارُ أحمد «20 أ»، والبوستر اقتراحُه) ======
 *
 * صفحتا المسلسل والفيلم لم تعرّفا معاينةً قطّ، فكان رابطُ أيِّ عملٍ في واتساب وX يظهر ببطاقة Loopz العامّة — لا يعرف من
 * يراها أيَّ عملٍ في الرابط. الآن: الاسمُ والسنة، وسطرٌ عنه (النوعُ والتصنيفُ والمواسمُ أو المدّة، ثمّ بدايةُ الوصف)،
 * **وبوستر العمل**: صورةٌ طوليّةٌ يعرضها واتساب صغيرةً بجانب البطاقة لا عريضةً فوقها.
 *
 * ⚖️ **الصورةُ من ممرّنا لا من TMDB** (`/i/w500/…`، D-841): برنامجُ المعاينة يجلبها من جهاز المرسِل أحياناً، و`image.tmdb.org`
 * لا يصل من أجهزة مستخدمينا (D-726). والممرُّ مفتوحٌ للزائر في الحارس (`proxy.ts`).
 * ⚖️ **العنوانُ لا يتغيّر في تبويب المتصفّح**: البطاقةُ وحدَها (`openGraph` · `twitter`) — العنوانُ قرارٌ آخر.
 */
export type TitleCard = {
  kind: "tv" | "movie";
  name: string;
  date: string | null;
  genres: string[];
  /** مسلسلٌ: عددُ المواسم · فيلمٌ: الدقائق */
  extent: number | null;
  overview: string;
  posterPath: string | null;
  path: string;
  locale: "ar" | "en";
};

const POSTER_FILE = /^\/[A-Za-z0-9]+\.(?:jpg|png)$/;

function clip(s: string, max: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function titleCardText(c: TitleCard): { title: string; description: string } {
  const ar = c.locale === "ar";
  const year = c.date && /^\d{4}/.test(c.date) ? c.date.slice(0, 4) : "";
  const title = `${c.name}${year ? ` (${year})` : ""} — ${ar ? "على Loopz" : "on Loopz"}`;
  const facts: string[] = [c.kind === "tv" ? (ar ? "مسلسل" : "Series") : ar ? "فيلم" : "Movie"];
  if (c.genres.length) facts.push(c.genres.slice(0, 2).join(ar ? " و" : " & "));
  if (c.extent && c.extent > 0) {
    if (c.kind === "tv") facts.push(ar ? `${c.extent} ${c.extent >= 3 && c.extent <= 10 ? "مواسم" : "موسم"}` : `${c.extent} season${c.extent === 1 ? "" : "s"}`);
    else facts.push(ar ? `${c.extent} دقيقة` : `${c.extent} min`);
  }
  const head = facts.join(" · ");
  const description = c.overview.trim() ? `${head} — ${clip(c.overview, 150)}` : head;
  return { title, description };
}

export function titleMetadata(c: TitleCard): Metadata {
  const { title, description } = titleCardText(c);
  const image = c.posterPath && POSTER_FILE.test(c.posterPath) ? `/i/w500/${c.posterPath.slice(1)}` : null;
  const images = image ? [{ url: image, width: 500, height: 750, alt: c.name }] : undefined;
  return {
    openGraph: {
      type: c.kind === "tv" ? "video.tv_show" : "video.movie",
      title,
      description,
      url: c.path,
      ...(images ? { images } : {}),
    },
    /* `summary` لا `summary_large_image`: البوسترُ طوليٌّ، والبطاقةُ الكبيرة تقصّه عريضاً */
    twitter: { card: "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}
