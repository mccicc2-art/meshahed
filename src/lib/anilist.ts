/**
 * AniList — ما لا تعرفه TMDB عن الأنمي (D-173).
 *
 * **الفجوة:** TMDB تعرف الأنمي مسلسلاً كأي مسلسل — أنواعُه ومواسمُه وشبكتُه.
 * ولا تعرف **مصدره** (مانغا؟ رواية خفيفة؟ أصليّ؟) ولا **استوديو الرسوم**
 * (`networks` عندها قناةُ البثّ لا الاستوديو: «Tokyo MX» لا «MAPPA»).
 * وهذان أوّلُ ما يسأل عنه من يتابع الأنمي.
 *
 * **الجسر، وهو أصعب ما في الباب:** **لا مصدرَ أنمي واحد يُعيد معرّف TMDB**
 * (بحث ١٢ أغسطس). AniList يعطي `idMal` وحده. فالربط عبر خدمة `arm`
 * العامّة — تقبل معرّف TMDB وتعيد معرّف AniList، **نداءٌ واحد بلا جدولٍ
 * يُحمَّل ولا فهرسٍ يُعكَس**.
 *
 * **وثلاث طبقاتٍ من الصمت، لأن السلسلة من طرفين لا نملكهما:**
 *  ١) خدمة `arm` لم تردّ أو لم تعرف المعرّف → `null`.
 *  ٢) AniList لم يردّ أو حدُّه امتلأ → `null`.
 *  ٣) ردَّ بلا الحقول التي نريد → `null`.
 * وفي كل حال **تبقى الصفحة كما هي بالضبط**. لا شاشةَ خطأ ولا فراغٌ محجوز.
 *
 * ⚠️ **وحدٌّ يُقال:** ترخيص AniList التجاريّ **غير مؤكَّد** — توثيقهم يصف
 * الواجهة بأنها «مجانية ومتاحة للعموم» وشروطُ موقعهم العامّة فيها بندٌ
 * قالبيّ عن الاستخدام الشخصيّ. أُرسلت إليهم رسالةُ استيضاح
 * (`claude/outreach-2026-08-12-data-sources.md`). **إن جاء ردٌّ مانع،
 * فحذفُ هذا الملفّ ونداءَيه هو كلّ المطلوب — لا شيء آخر يعتمد عليه.**
 */

/** خدمة ربط المعرّفات — عامّة، بلا مفتاح، ونناديها ولا نستضيفها (رخصتها AGPL) */
const ARM = "https://arm.haglund.dev/api/v2/themoviedb";
const ANILIST = "https://graphql.anilist.co";

/** ترويسة صريحة كما في `wikidata.ts` — الخدمات العامّة تحجب المجهولين */
const UA = "LoopzBot/1.0 (https://loopztv.com)";

/** مصدرُ العمل كما يسمّيه AniList — يُترجَم في `i18n` لا هنا */
export type AnimeSource =
  | "ORIGINAL"
  | "MANGA"
  | "LIGHT_NOVEL"
  | "VISUAL_NOVEL"
  | "VIDEO_GAME"
  | "NOVEL"
  | "DOUJINSHI"
  | "ANIME"
  | "WEB_NOVEL"
  | "OTHER";

export interface AnimeExtras {
  source: AnimeSource | null;
  /** استوديو الرسوم الرئيسيّ — لا قناة البثّ */
  studio: string | null;
}

/** معرّف AniList من معرّف TMDB — أو `null` */
async function anilistIdFor(tmdbId: number, mediaType: "tv" | "movie"): Promise<number | null> {
  try {
    const res = await fetch(
      `${ARM}?id=${tmdbId}&type=${mediaType === "tv" ? "show" : "movie"}&include=anilist`,
      {
        headers: { Accept: "application/json", "User-Agent": UA },
        /* أسبوع: الربط بين معرّفين **لا يتغيّر**. ونفس منطق تخبئة
           `wikidata.ts` — جوابٌ ثابت لا يُسأل عنه مرّتين. */
        next: { revalidate: 604_800 },
      },
    );
    if (!res.ok) return null;
    const j: unknown = await res.json();
    /* **قارئٌ يمشي على الشكل ولا يفترضه** (نمط D-154): الخدمة قد تعيد
       كائناً أو مصفوفةً من كائنات، وقد تسمّي الحقل `anilist`. نلتقط أوّل
       رقمٍ صالح تحت هذا الاسم أينما كان، فلا يكسرنا تغيُّرُ الغلاف. */
    const pick = (v: unknown): number | null => {
      if (Array.isArray(v)) {
        for (const x of v) {
          const got = pick(x);
          if (got) return got;
        }
        return null;
      }
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const n = o.anilist;
        if (typeof n === "number" && n > 0) return n;
        if (typeof n === "string" && /^\d+$/.test(n)) return Number(n);
      }
      return null;
    };
    return pick(j);
  } catch {
    return null;
  }
}

/**
 * المصدر والاستوديو من AniList — أو `null`.
 *
 * الاستعلام يطلب **حقلين فقط**: طلبُ ما لا يُعرض إنفاقٌ من حدٍّ مشترك
 * (٣٠ طلباً في الدقيقة اليوم عندهم) لا يشتري شيئاً.
 */
async function extrasFor(anilistId: number): Promise<AnimeExtras | null> {
  const query = `query($id:Int){Media(id:$id,type:ANIME){source studios(isMain:true){nodes{name}}}}`;
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({ query, variables: { id: anilistId } }),
      /* يومٌ واحد لا أسبوع: المصدر والاستوديو ثابتان، **لكن العمل الجديد
         قد يُسجَّل عندهم ناقصاً ثم يُكمَّل** — واليوم يلحق ذلك بلا إثقال. */
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      data?: {
        Media?: {
          source?: string | null;
          studios?: { nodes?: { name?: string }[] } | null;
        } | null;
      };
    };
    const m = j.data?.Media;
    if (!m) return null;
    const studio = m.studios?.nodes?.find((n) => n.name)?.name ?? null;
    const source = (m.source as AnimeSource | undefined) ?? null;
    if (!studio && !source) return null;
    return { source, studio };
  } catch {
    return null;
  }
}

/**
 * الواجهة الوحيدة للمستدعين — معرّف TMDB يدخل، وسطرُ حقائق يخرج أو لا شيء.
 *
 * **ولا تُستدعى إلا لِما ثبت أنه أنمي** (`isAnime` في صفحة العمل): سؤالُ
 * خدمتين عن «الأب الروحي» إنفاقٌ لا جواب له.
 */
export async function animeExtras(
  tmdbId: number,
  mediaType: "tv" | "movie",
): Promise<AnimeExtras | null> {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;
  const id = await anilistIdFor(tmdbId, mediaType);
  if (!id) return null;
  return extrasFor(id);
}
