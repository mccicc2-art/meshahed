import "server-only";

import { GIF_ID_RE, gifUrl } from "./media";

/**
 * **بحثُ الـGIF — من الخادم، ومعرّفاً لا رابطاً** (D-362، طلبُ أحمد:
 * «ابغا أضيف خيار جنب الصور GIF، خيار سريع وبديل عن الصور»).
 *
 * ================= لماذا Giphy لا Tenor =================
 *
 * **اختار أحمد Tenor، وردّ القياسُ اختيارَه**: توثيقُ Google يقول بنصّه
 * **«The Tenor API is no longer accepting new clients as of January
 * 2026»** — **فلا مفتاحَ لنا فيه أصلاً.** **والمعمارُ لم يتغيّر، تغيّر
 * المزوّدُ وحدَه** (D-152: القياسُ يسبق الاختيار ولا يُلتفّ عليه).
 *
 * ================= والمفتاحُ باسمه وحدَه =================
 *
 * `GIPHY_API_KEY` في Vercel بيد أحمد (القاعدة ١٤)، **وغيابُه تعطيلٌ
 * صامتٌ لا عطل** (D-077): قائمةٌ فارغةٌ والزرُّ لا يُرسم.
 *
 * ================= وثلاثةُ حرّاسٍ كحرّاس الترجمة =================
 *
 * **مهلةٌ ٤ ثوانٍ** (خدمةٌ بطيئةٌ لا تُبقي القارئَ ينتظر — نصُّ
 * `translate.ts`) · **سقفُ نتائج** · **وتصنيفٌ `pg-13`**: سطحٌ عامٌّ
 * يقرؤه كلُّ الأعضاء، **والمزوّدُ يملك المرشِّح فلا نبني واحداً**.
 *
 * ⚠️ **ولا يُخزَّن رابطٌ أبداً — يُعاد المعرّفُ وحدَه** (D-362): الرابطُ
 * يُركَّب في الواجهة من قالبٍ ثابت، **فما يعبر حدودَنا سلسلةُ حروفٍ
 * وأرقامٍ لا عنوانٌ يذهب إلى أيّ مكان** (D-298/D-302 بحجّتهما).
 */

/** ما تحتاجه البطاقةُ في الشبكة — **ولا رابطَ عرضٍ في القاعدة** */
export interface GifHit {
  /** معرّفُ Giphy — `[A-Za-z0-9]` وحدَه، وهو ما يُخزَّن */
  id: string;
  /** معاينةٌ خفيفةٌ للشبكة (تُبنى من المعرّف، وتُستعمل في الورقة فقط) */
  preview: string;
  /** نسبةُ العرض إلى الارتفاع — **فلا يقفز الصفُّ بعد الرسم** (D-046) */
  ratio: number;
  /** وصفٌ بديلٌ لقارئ الشاشة (القاعدة ١٦) */
  alt: string;
}

/* **والقالبُ في `media.ts`** لأن قارئيه ضفّتان: هذا الملفّ والمتصفّح */
const GIF_ID = GIF_ID_RE;

interface GiphyRow {
  id?: string;
  title?: string;
  images?: {
    fixed_width?: { url?: string; width?: string; height?: string };
  };
}

async function call(path: string, params: Record<string, string>): Promise<GifHit[]> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return [];
  const q = new URLSearchParams({ api_key: key, rating: "pg-13", ...params });
  try {
    const r = await fetch(`https://api.giphy.com/v1/gifs/${path}?${q}`, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: GiphyRow[] };
    const out: GifHit[] = [];
    for (const g of j.data ?? []) {
      const id = String(g.id ?? "");
      if (!GIF_ID.test(id)) continue;
      const w = Number(g.images?.fixed_width?.width ?? 0);
      const h = Number(g.images?.fixed_width?.height ?? 0);
      out.push({
        id,
        preview: gifUrl(id, "small") as string,
        /* **نسبةٌ معقولةٌ عند الغياب** — ولا صفرَ يقسم عليه */
        ratio: w > 0 && h > 0 ? w / h : 1,
        alt: String(g.title ?? "GIF").slice(0, 90),
      });
    }
    return out;
  } catch {
    /* شبكةٌ أو مهلةٌ — **الغيابُ أصدق من نصف نتيجة** (D-063) */
    return [];
  }
}

/** الرائجُ حين لا يكتب القارئُ شيئاً — **ورقةٌ فارغةٌ ليست بابَ بحث** */
export function trendingGifs(limit = 24): Promise<GifHit[]> {
  return call("trending", { limit: String(limit) });
}

export function searchGifs(query: string, limit = 24): Promise<GifHit[]> {
  const q = query.trim().slice(0, 60);
  if (!q) return trendingGifs(limit);
  return call("search", { q, limit: String(limit), lang: "en" });
}
