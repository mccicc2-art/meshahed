import { XMLParser } from "fast-xml-parser";

/**
 * الأخبار الحقيقية — سِجلُّ المصادر وقارئُها (D-209، المرحلة الأولى).
 *
 * **لماذا سجلٌّ لا قائمةُ روابطٍ في الطلب:** ما يدخل القاعدة يجب أن يكون
 * محصوراً بمصادرَ نعرفها بالاسم — **ولا شيءٌ من جسم الطلب يصير خبراً**.
 * وهو نفسُ حارس `‎/api/imdb-chart` بالضبط: الضررُ المحتمل **كلفةُ نداءات
 * لا فسادُ بيانات**.
 *
 * **والبِنيةُ هنا قراءةٌ وتطبيعٌ فقط — لا كتابة.** المرحلةُ الأولى تجيب
 * سؤالاً واحداً لا يجيبه إلا الخادم: **أيُّ فيدٍ يُجلب من Vercel فعلاً؟**
 * (بحثُ ١٠ أغسطس ردّ ٤٠٢/٤٠٣ على أدوات الجلب لديدلاين وفارايتي وكلِّ
 * مصادر الأنمي — **والنمطُ يقول إن الحجب على الأداة لا أن الفيد غائب**.)
 *
 * **وقاعدة D-144 تحكم ما بعدها:** ما لا يُثبَّت بـ`tmdb_id` لا يُعرض
 * منسوباً إلى عمل — فالمطابقةُ بالاسم هي التي كذبت علينا في جداول الجوائز.
 */

export type NewsLang = "ar" | "en";

export interface NewsSource {
  /** المعرّف الذي يُخزَّن مع الخبر — لا اسمُ الموقع، فالأسماء تُترجَم */
  slug: string;
  label: string;
  url: string;
  lang: NewsLang;
  /** ترتيبُ الثقة من بحث ١٠ أغسطس: كم عنواناً يسمّي عملاً بعينه */
  precision: "high" | "medium" | "unknown";
  /** مرشّحٌ لم يُثبت بعد — يُجرَّب في الفحص ولا يُبتلع */
  candidate?: boolean;
  /**
   * **يدخل الابتلاع فعلاً.** الفحصُ الحيّ في ١٢ أغسطس هو الذي رفع هذا
   * العلَم أو أسقطه — لا الظنّ: ما ردّ ٤٠٣/٤٠٤ أو قناةً فارغة يبقى في
   * السجلّ **بلا علَم** كي لا تُعاد تجربتُه من الصفر كلَّ مرّة، وكي
   * يبقى سببُ سقوطه مكتوباً بجانبه.
   */
  enabled?: boolean;
}

/**
 * السجلّ. **الترتيب معنًى:** ما دقّتُه عالية أوّلاً — لأن الخبر الذي لا
 * يسمّي عملاً لا يُنسب إلى عمل، فيبقى نصّاً بلا بابٍ إلى التطبيق.
 */
export const NEWS_SOURCES: NewsSource[] = [
  // ===== عربي =====
  {
    slug: "masrawy-cinema",
    label: "مصراوي — سينما",
    url: "https://www.masrawy.com/rss/feed/254/%D8%B3%D9%8A%D9%86%D9%85%D8%A7",
    lang: "ar",
    precision: "high",
  },
  {
    slug: "masrawy-tv",
    label: "مصراوي — مسرح وتليفزيون",
    url: "https://www.masrawy.com/rss/feed/235/%D9%85%D8%B3%D8%B1%D8%AD-%D9%88%D8%AA%D9%84%D9%8A%D9%81%D8%B2%D9%8A%D9%88%D9%86",
    lang: "ar",
    precision: "high",
  },
  {
    slug: "rt-arabic-culture",
    label: "RT عربية — ثقافة",
    url: "https://arabic.rt.com/rss/culture/",
    lang: "ar",
    precision: "medium",
  },
  // ===== إنجليزي =====
  {
    slug: "tvline",
    label: "TVLine",
    url: "https://tvline.com/feed/",
    lang: "en",
    precision: "high",
    enabled: true,
  },
  {
    slug: "screenrant",
    label: "ScreenRant",
    url: "https://screenrant.com/feed/",
    lang: "en",
    precision: "medium",
    enabled: true,
  },
  {
    slug: "slashfilm",
    label: "/Film",
    url: "https://www.slashfilm.com/feed/",
    lang: "en",
    precision: "medium",
    enabled: true,
  },
  /* ردّتا ٤٠٢ على أداة الجلب في ١٠ أغسطس — **تُعادان من الخادم** */
  {
    slug: "deadline",
    label: "Deadline",
    url: "https://deadline.com/feed/",
    lang: "en",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "variety",
    label: "Variety",
    url: "https://variety.com/feed/",
    lang: "en",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  // ===== أنمي — لم يُتحقّق من واحدٍ منها بعد =====
  {
    slug: "ann",
    label: "Anime News Network",
    url: "https://www.animenewsnetwork.com/all/rss.xml",
    lang: "en",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "mal",
    label: "MyAnimeList",
    url: "https://myanimelist.net/rss/news.xml",
    lang: "en",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "crunchyroll",
    label: "Crunchyroll",
    url: "https://www.crunchyroll.com/news/rss",
    lang: "en",
    precision: "unknown",
    candidate: true,
  },
  // ===== مرشّحون عرب — الطرفُ الفقير، ويُوسَّع بالفحص لا بالظنّ =====
  {
    slug: "youm7-art",
    label: "اليوم السابع — فن",
    url: "https://www.youm7.com/rss/SectionRss?SectionID=42",
    lang: "ar",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "ahram-arts",
    label: "بوابة الأهرام — فنون",
    url: "https://gate.ahram.org.eg/rss/32.aspx",
    lang: "ar",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "elfann",
    label: "الفن",
    url: "https://www.elfann.com/rss/news.xml",
    lang: "ar",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "skynews-arabia-var",
    label: "سكاي نيوز عربية — منوعات",
    url: "https://www.skynewsarabia.com/web/rss/varieties.xml",
    lang: "ar",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "euronews-arabic-culture",
    label: "يورونيوز عربي — ثقافة",
    url: "https://arabic.euronews.com/rss?level=vertical&name=culture",
    lang: "ar",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  /* **جوجل نيوز بحثاً لا موقعاً** — والسببُ اضطراريّ: مصراوي (أدقُّ مصدرٍ
     عربيّ في بحث ١٠ أغسطس) **تردّ ٤٠٣ على خادم Vercel** مهما كان الوكيل،
     فالحجبُ على العنوان لا على الاسم. وفيدُ البحث يعطي **ما يسمّي عملاً
     بحكم الاستعلام نفسه**، وينسب كلَّ خبرٍ لمصدره الأصليّ في عنوانه. */
  {
    slug: "gnews-ar-series",
    label: "أخبار المسلسلات (عربي)",
    url: "https://news.google.com/rss/search?q=%D9%85%D8%B3%D9%84%D8%B3%D9%84&hl=ar&gl=EG&ceid=EG:ar",
    lang: "ar",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "gnews-ar-movies",
    label: "أخبار الأفلام (عربي)",
    url: "https://news.google.com/rss/search?q=%D9%81%D9%8A%D9%84%D9%85&hl=ar&gl=EG&ceid=EG:ar",
    lang: "ar",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "gnews-ar-anime",
    label: "أخبار الأنمي (عربي)",
    url: "https://news.google.com/rss/search?q=%D8%A3%D9%86%D9%85%D9%8A&hl=ar&gl=EG&ceid=EG:ar",
    lang: "ar",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "cnn-arabic-ent",
    label: "CNN بالعربية — ترفيه",
    url: "https://arabic.cnn.com/entertainment/rss",
    lang: "ar",
    precision: "unknown",
    candidate: true,
    enabled: true,
  },
  {
    slug: "filfan",
    label: "في الفن",
    url: "https://www.filfan.com/rss/all",
    lang: "ar",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "aljazeera-culture",
    label: "الجزيرة — فنون وثقافة",
    url: "https://www.aljazeera.net/xml/rss/all.xml",
    lang: "ar",
    precision: "unknown",
    candidate: true,
  },
];

export interface RawNewsItem {
  source: string;
  lang: NewsLang;
  title: string;
  url: string;
  summary: string | null;
  image: string | null;
  publishedAt: string | null;
}

export interface ProbeResult {
  slug: string;
  label: string;
  lang: NewsLang;
  precision: string;
  ok: boolean;
  status: number | null;
  bytes: number;
  items: number;
  withImage: number;
  withDate: number;
  ms: number;
  sample: string[];
  error?: string;
}

/* المحلّل واحدٌ للجميع: RSS 2.0 وAtom كلاهما XML، والفروقُ في أسماء
   العُقد لا في الشكل — فمحلّلان لشيءٍ واحد بدايةُ اختلافهما */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  /* CDATA يُدمج في النصّ بدل أن يصير عقدةً ثالثة */
  cdataPropName: false as unknown as string,
});

/** نصٌّ من عقدةٍ قد تكون سلسلةً أو كائناً (`#text`) أو مصفوفة */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    if ("#text" in o) return text(o["#text"]);
    if ("@_href" in o) return String(o["@_href"]);
  }
  return "";
}

/** وسومُ HTML تُنزع من الملخّص: الفيد يعطي فقرةً كاملة أحياناً */
function plain(html: string, max = 300): string {
  const s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** أوّلُ صورةٍ يعطيها الفيد — بابُها أربعةٌ، والترتيب من الأدقّ للأضعف */
function imageOf(item: Record<string, unknown>): string | null {
  const enclosure = item["enclosure"] as Record<string, unknown> | undefined;
  const encUrl = enclosure?.["@_url"];
  if (typeof encUrl === "string" && /^https?:\/\//.test(encUrl)) return encUrl;

  const media = (item["media:content"] ?? item["media:thumbnail"]) as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  const first = Array.isArray(media) ? media[0] : media;
  const mediaUrl = first?.["@_url"];
  if (typeof mediaUrl === "string" && /^https?:\/\//.test(mediaUrl)) return mediaUrl;

  /* آخرُ الأبواب: أوّلُ `<img>` داخل جسم المقال — أضعفُها لأنها قد تكون
     أيقونةَ تتبّعٍ بحجم بكسل، ولذلك تُقاس لاحقاً لا تُصدَّق هنا */
  const body = text(item["content:encoded"]) || text(item["description"]);
  const m = body.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

function dateOf(item: Record<string, unknown>): string | null {
  const raw =
    text(item["pubDate"]) || text(item["published"]) || text(item["updated"]) || text(item["dc:date"]);
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * جلبُ فيدٍ وتطبيعُه. **لا يرمي:** المصدرُ الذي يسقط يُبلَّغ عنه ولا
 * يُسقِط البقية — عشرةُ مصادرَ في نداءٍ واحد، وواحدٌ منها بطيء.
 */
export async function fetchFeed(
  src: NewsSource,
  limit = 20,
): Promise<{ items: RawNewsItem[]; status: number | null; bytes: number; error?: string }> {
  try {
    const res = await fetch(src.url, {
      /* بعضُ المواقع ترفض الطلبَ بلا وكيل — وليس تنكّراً: اسمُنا فيه
         ورابطُنا، فمن أراد منعَنا يستطيع */
      headers: {
        /* يبدأ بـ`Mozilla/5.0` **لا تنكّراً**: اسمُنا ورابطُنا باقيان فيه،
           لكنّ جدرانَ الحماية (مصراوي منها) ترفض كلَّ ما لا يبدأ بها */
        "user-agent": "Mozilla/5.0 (compatible; LoopzBot/1.0; +https://loopztv.com)",
        accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    if (!res.ok) {
      return { items: [], status: res.status, bytes: body.length, error: `http ${res.status}` };
    }

    const doc = parser.parse(body) as Record<string, unknown>;
    const rss = doc["rss"] as Record<string, unknown> | undefined;
    const channel = rss?.["channel"] as Record<string, unknown> | undefined;
    const feed = doc["feed"] as Record<string, unknown> | undefined;
    const rawList = (channel?.["item"] ?? feed?.["entry"] ?? []) as unknown;
    const list = (Array.isArray(rawList) ? rawList : [rawList]).filter(Boolean) as Record<
      string,
      unknown
    >[];

    const items: RawNewsItem[] = [];
    for (const it of list.slice(0, limit)) {
      const title = plain(text(it["title"]), 200);
      const link = text(it["link"]) || text(it["guid"]);
      if (!title || !/^https?:\/\//.test(link)) continue;
      items.push({
        source: src.slug,
        lang: src.lang,
        title,
        url: link,
        summary: plain(text(it["description"]) || text(it["summary"]) || "") || null,
        image: imageOf(it),
        publishedAt: dateOf(it),
      });
    }
    return { items, status: res.status, bytes: body.length };
  } catch (e) {
    return { items: [], status: null, bytes: 0, error: (e as Error).message };
  }
}

/** فحصُ المصادر كلّها — قراءةٌ محضة، ولا كتابةَ في القاعدة */
export async function probeSources(sources = NEWS_SOURCES): Promise<ProbeResult[]> {
  return Promise.all(
    sources.map(async (src) => {
      const t0 = Date.now();
      const r = await fetchFeed(src);
      return {
        slug: src.slug,
        label: src.label,
        lang: src.lang,
        precision: src.candidate ? `${src.precision} (candidate)` : src.precision,
        ok: r.items.length > 0,
        status: r.status,
        bytes: r.bytes,
        items: r.items.length,
        withImage: r.items.filter((i) => i.image).length,
        withDate: r.items.filter((i) => i.publishedAt).length,
        ms: Date.now() - t0,
        sample: r.items.slice(0, 3).map((i) => i.title),
        ...(r.error ? { error: r.error } : {}),
      };
    }),
  );
}

// ============================================================
//  الابتلاع — من الفيد إلى صفٍّ منسوبٍ إلى عمل
// ============================================================

/**
 * **جوجل نيوز يذيّل عنوانه باسم الناشر** (`… - Masrawy`). واسمُ الناشر
 * ليس جزءاً من الخبر — يُقصّ ويُخزَّن في عموده، فيُعرض «مصراوي» شارةً لا
 * ذيلاً في الجملة.
 */
function splitPublisher(title: string): { title: string; label: string | null } {
  const i = title.lastIndexOf(" - ");
  if (i < 12) return { title, label: null };
  const label = title.slice(i + 3).trim();
  /* اسمُ ناشرٍ لا جملةٌ: ما طال عن ٤٠ محرفاً أو حمل نقطةً ختامية ليس اسماً */
  if (!label || label.length > 40 || /[.!?]$/.test(label)) return { title, label: null };
  return { title: title.slice(0, i).trim(), label };
}

/** تطبيعٌ للمقارنة: حروفٌ وأرقامٌ ومسافةٌ واحدة، بلا تشكيلٍ ولا همزات مختلفة */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ةه]/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const AR_KIND = /(?:مسلسل|فيلم|أنمي|انمي|برنامج)\s+/;

/**
 * مرشّحو اسمِ العمل داخل العنوان — **ثلاثةٌ على الأكثر، وبالترتيب**:
 * ما بين علامتَي اقتباس، ثم ما يلي كلمةَ «مسلسل/فيلم/أنمي»، ثم أوّلُ
 * مقطعٍ لاتينيّ بحرفٍ كبير. **ولا يُخترع اسمٌ:** ما لا يظهر في العنوان
 * لا يُبحث عنه.
 */
export function titleCandidates(headline: string): string[] {
  const out: string[] = [];
  const quoted = headline.match(/[«"“”]([^«»"“”]{2,60})[»"“”]/);
  if (quoted) out.push(quoted[1]);

  const after = headline.split(AR_KIND)[1];
  if (after) {
    const cut = after.split(/[.،,:؛|()\-–—]/)[0].split(/\s+/).slice(0, 4).join(" ");
    if (cut) out.push(cut);
  }

  /* **المقطعُ اللاتينيّ يُقصّ إلى أربع كلمات.** أوّلُ نسخةٍ أخذته كاملاً،
     فصار المرشّحُ عنواناً بأكمله («Yellowjackets Season 4 Premiere Date
     Set at Showtime») ولا يجد TMDB شيئاً — **مطابقةٌ واحدة من ١٢٠**.
     والاسمُ يقع في أوّل الجملة عادةً، لا في آخرها. */
  const latin = headline.match(/[A-Z][A-Za-z0-9'&.:\- ]{3,60}/);
  if (latin) out.push(latin[0].split(/\s+/).slice(0, 4).join(" "));

  /* وأوّلُ ثلاث كلماتٍ من العنوان: عناوينُ TVLine وVariety تبدأ باسم
     العمل ثم خبرِه («Yellowjackets Season 4…») */
  const head3 = headline.split(/\s+/).slice(0, 3).join(" ");
  if (head3) out.push(head3);

  const seen = new Set<string>();
  return out
    .map((s) => s.replace(/\s+/g, " ").replace(/[:،,.\-–—]+$/, "").trim())
    .filter((s) => s.length >= 3 && !seen.has(s) && seen.add(s))
    .slice(0, 3);
}

/**
 * النسبةُ إلى عمل — **بمعرّف TMDB أو لا نسبة** (D-144).
 *
 * **والشرطُ الذي يمنع الكذب:** لا يكفي أن يردّ TMDB نتيجةً — يجب أن
 * **يحتوي العنوانُ نفسُه اسمَ العمل** بعد التطبيع. فبحثُ «فيلم» وحدها
 * يعيد مئةَ عمل، ولا واحدَ منها في العنوان.
 */
export async function matchTitle(
  headline: string,
  budget: { left: number },
): Promise<{ tmdbId: number; mediaType: "tv" | "movie" } | null> {
  const flat = norm(headline);
  for (const cand of titleCandidates(headline)) {
    if (budget.left <= 0) return null;
    budget.left -= 1;
    let rows;
    try {
      const { searchMulti } = await import("@/lib/tmdb");
      rows = await searchMulti(cand);
    } catch {
      return null;
    }
    for (const r of (rows ?? []).slice(0, 3)) {
      if (r.media_type !== "tv" && r.media_type !== "movie") continue;
      /* **الاسمان معاً: المترجَمُ والأصليّ.** خبرٌ عربيّ قد يسمّي العمل
         بالإنجليزية والعكس — ومقارنةٌ بواحدٍ منهما تُسقط نصفَ المطابقات */
      const raw = r as unknown as Record<string, unknown>;
      const names = [r.title, r.name, raw["original_title"], raw["original_name"]]
        .map((v) => norm(String(v ?? "")))
        /* اسمٌ من كلمةٍ قصيرة يطابق أيَّ شيء — «Up» و«It» و«صدفة» */
        .filter((v) => v.length >= 4);
      if (names.some((n) => flat.includes(n))) {
        return { tmdbId: r.id, mediaType: r.media_type };
      }
    }
  }
  return null;
}

export interface NewsRow {
  url: string;
  source: string;
  source_label: string | null;
  lang: NewsLang;
  title: string;
  summary: string | null;
  published_at: string | null;
  tmdb_id: number | null;
  media_type: "tv" | "movie" | null;
}

/**
 * دفعةُ ابتلاعٍ كاملة: جلبُ المصادر المُثبَتة ثم النسبةُ بميزانيةٍ معلَنة.
 *
 * **الميزانيةُ رقمٌ لا رجاء:** ستّون نداءَ TMDB للدفعة كلِّها. بلا سقفٍ
 * كانت الدفعةُ الواحدة قد تطلب مئتين — **وثمنُ ذلك يقع على مسارٍ يبدأ
 * لأن زائراً فتح تبويباً**.
 */
export async function collectNews(perSource = 8, tmdbBudget = 90): Promise<NewsRow[]> {
  const live = NEWS_SOURCES.filter((s) => s.enabled);
  const fetched = await Promise.all(live.map((s) => fetchFeed(s, perSource)));

  const budget = { left: tmdbBudget };
  const rows: NewsRow[] = [];
  const seen = new Set<string>();

  for (const r of fetched) {
    for (const it of r.items) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      const { title, label } = splitPublisher(it.title);
      const hit = await matchTitle(title, budget);
      rows.push({
        url: it.url,
        source: it.source,
        source_label: label,
        lang: it.lang,
        title,
        summary: it.summary,
        published_at: it.publishedAt,
        tmdb_id: hit?.tmdbId ?? null,
        media_type: hit?.mediaType ?? null,
      });
    }
  }
  return rows;
}
