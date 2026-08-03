// أدوات آمنة للاستخدام في الخادم والمتصفح معاً (لا تستورد next/headers)

export const IMG = "https://image.tmdb.org/t/p";

export type MediaType = "tv" | "movie";

export function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  return path ? `${IMG}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: "w300" | "w500" | "w780" | "w1280" = "w1280") {
  return path ? `${IMG}/${size}${path}` : null;
}

export function titleOf(r: { title?: string; name?: string }): string {
  return r.title ?? r.name ?? "—";
}

export function yearOf(r: { first_air_date?: string | null; release_date?: string | null }): string {
  const d = r.first_air_date ?? r.release_date;
  return d ? d.slice(0, 4) : "";
}

// الأنواع المتاحة للاختيار في الملف الشخصي (معرّفات TMDB)
export const GENRES: { id: number; ar: string; en: string; emoji: string }[] = [
  { id: 35, ar: "كوميدي", en: "Comedy", emoji: "😂" },
  { id: 18, ar: "دراما", en: "Drama", emoji: "🎭" },
  { id: 10759, ar: "أكشن ومغامرة", en: "Action & Adventure", emoji: "💥" },
  { id: 9648, ar: "غموض", en: "Mystery", emoji: "🕵️" },
  { id: 80, ar: "جريمة", en: "Crime", emoji: "🚔" },
  { id: 10765, ar: "خيال علمي وفانتازيا", en: "Sci-Fi & Fantasy", emoji: "🚀" },
  { id: 16, ar: "رسوم متحركة", en: "Animation", emoji: "🎨" },
  { id: 99, ar: "وثائقي", en: "Documentary", emoji: "📚" },
  { id: 10751, ar: "عائلي", en: "Family", emoji: "👨‍👩‍👧" },
  { id: 10766, ar: "دراما يومية", en: "Soap", emoji: "📺" },
  { id: 37, ar: "غربي", en: "Western", emoji: "🤠" },
  { id: 10768, ar: "حربي وسياسي", en: "War & Politics", emoji: "⚔️" },
];

export function genreName(g: { ar: string; en: string }, locale: "ar" | "en") {
  return locale === "en" ? g.en : g.ar;
}
