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
  { slug: "tvline", label: "TVLine", url: "https://tvline.com/feed/", lang: "en", precision: "high" },
  {
    slug: "screenrant",
    label: "ScreenRant",
    url: "https://screenrant.com/feed/",
    lang: "en",
    precision: "medium",
  },
  {
    slug: "slashfilm",
    label: "/Film",
    url: "https://www.slashfilm.com/feed/",
    lang: "en",
    precision: "medium",
  },
  /* ردّتا ٤٠٢ على أداة الجلب في ١٠ أغسطس — **تُعادان من الخادم** */
  {
    slug: "deadline",
    label: "Deadline",
    url: "https://deadline.com/feed/",
    lang: "en",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "variety",
    label: "Variety",
    url: "https://variety.com/feed/",
    lang: "en",
    precision: "unknown",
    candidate: true,
  },
  // ===== أنمي — لم يُتحقّق من واحدٍ منها بعد =====
  {
    slug: "ann",
    label: "Anime News Network",
    url: "https://www.animenewsnetwork.com/all/rss.xml",
    lang: "en",
    precision: "unknown",
    candidate: true,
  },
  {
    slug: "mal",
    label: "MyAnimeList",
    url: "https://myanimelist.net/rss/news.xml",
    lang: "en",
    precision: "unknown",
    candidate: true,
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
