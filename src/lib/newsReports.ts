import { createClient } from "@/lib/supabase/server";
import { NEWS_SOURCES, fetchFeed, matchTitle } from "@/lib/news";
import type { GeneratedPost } from "@/lib/loopzNews";

/**
 * **الحدثُ من الصحافة، والجملةُ من عندنا** (D-213).
 *
 * **طلبُ أحمد:** «عادي نحطّ المصدر كرابط تحت بالخطّ الصغير، لكن المحتوى
 * ننقله عندنا». **ورُدَّ على النقل:** الإسنادُ ليس رخصة، والنصُّ ملكُ
 * ناشره. **وهذا الملفّ هو البديلُ المقبول:** الحقيقةُ لا يملكها أحد —
 * فنستخرج **الحدث** من العنوان بأنماطٍ صريحة، **ونكتب جملتنا** من قوالب
 * `i18n`، **ونضع اسمَ المصدر ورابطَه تحتها بالخطّ الصغير**.
 *
 * **وثلاثةُ قيودٍ تجعل هذا نظيفاً لا رمادياً:**
 * 1. **لا يُخزَّن نصٌّ من العنوان إطلاقاً** — يخرج منه `event` من قائمةٍ
 *    مغلقة (تجديد · إلغاء · تأجيل) ورقمُ موسمٍ إن وُجد. لا أكثر.
 * 2. **ولا خبرَ بلا `tmdb_id`** (D-144): ما لم نثبّته بعملٍ نعرفه يسقط
 *    صامتاً — **فالدقّةُ مقدَّمةٌ على العدد**، ونصفُ ما يُقرأ يسقط.
 * 3. **والمصدرُ يُذكر دائماً** — لا لأن القانون يُلزم وحده، **بل لأن خبراً
 *    بلا مصدرٍ يجعلنا مسؤولين عن صحّته**، ونحن لم نتحقّق منه بأنفسنا.
 */

type Event = "renewed" | "canceled" | "delayed";

/**
 * الأنماطُ الصريحة وحدها. **وما لا يُفهم يُترك** — عنوانٌ ملتبس يعني
 * خبراً ملتبساً، **وخبرٌ واحدٌ كاذب أغلى من عشرةٍ لم تُنشر.**
 */
const PATTERNS: { event: Event; re: RegExp; season?: boolean }[] = [
  { event: "renewed", re: /\brenewed for (?:a )?(?:season\s*(\d+)|(\d+)(?:st|nd|rd|th) season)/i, season: true },
  { event: "renewed", re: /\brenewed for (?:a )?(?:second|third|fourth|fifth|sixth|final)\s+season\b/i },
  { event: "renewed", re: /\b(?:gets|lands|scores) (?:a )?season\s*(\d+)\s+renewal\b/i, season: true },
  { event: "renewed", re: /(?:تجديد|جُدِّد|جدّدت|يُجدَّد)\s+(?:مسلسل\s+)?/ },
  { event: "canceled", re: /\b(?:cancell?ed|axed|ending with season|will end after)\b/i },
  { event: "canceled", re: /(?:إلغاء|أُلغي|يُلغى|إيقاف)\s+(?:مسلسل\s+)?/ },
  { event: "delayed", re: /\b(?:delayed|pushed back|release date moved|postponed)\b/i },
  { event: "delayed", re: /(?:تأجيل|أُجّل|يُؤجَّل)\s+/ },
];

/** رقمُ الموسم إن ذكره العنوان صراحةً — ولا يُخمَّن */
function seasonOf(headline: string, m: RegExpMatchArray | null): number | null {
  const fromMatch = m?.[1] ?? m?.[2];
  if (fromMatch && Number(fromMatch) > 0) return Number(fromMatch);
  const words: Record<string, number> = {
    second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
    الثاني: 2, الثالث: 3, الرابع: 4, الخامس: 5, السادس: 6,
  };
  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`\\b${w}\\b|${w}`).test(headline)) return n;
  }
  return null;
}

export function eventOf(headline: string): { event: Event; season: number | null } | null {
  for (const p of PATTERNS) {
    const m = headline.match(p.re);
    if (m) return { event: p.event, season: seasonOf(headline, m) };
  }
  return null;
}

/**
 * دفعةُ «أخبار الصحافة» — عناوينُ الفيدات المُثبَتة، **ولا يخرج منها إلا
 * ما فُهم حدثُه وثُبّت عملُه**.
 *
 * **والميزانيةُ معلَنة:** أربعون نداءَ بحثٍ في TMDB للدفعة. وما لم يُطابَق
 * لا يُخزَّن — **فقد تعود الدفعةُ بصفر، وذلك نجاحٌ لا عطل.**
 */
export async function collectReports(perSource = 10, tmdbBudget = 40): Promise<GeneratedPost[]> {
  const live = NEWS_SOURCES.filter((s) => s.enabled);
  const fetched = await Promise.all(live.map((s) => fetchFeed(s, perSource)));

  const budget = { left: tmdbBudget };
  const memo = new Map<string, { tmdbId: number; mediaType: "tv" | "movie" } | null>();
  const out: GeneratedPost[] = [];
  const seen = new Set<string>();

  /* تناوبٌ بين المصادر — درسُ D-210: المعالجةُ مصدراً بعد مصدر تُنفق
     الميزانيةَ كلَّها على أوّلها */
  const queues = fetched.map((f) => [...f.items]);
  for (let i = 0; i < perSource; i++) {
    for (const q of queues) {
      const it = q.shift();
      if (!it) continue;

      const ev = eventOf(it.title);
      if (!ev) continue;

      const hit = await matchTitle(it.title, budget, memo);
      /* **بلا عملٍ لا خبر** (D-144): «تجدّد مسلسلٌ ما» ليست جملةً تُنشر */
      if (!hit) continue;

      const label = NEWS_SOURCES.find((s) => s.slug === it.source)?.label ?? it.source;
      const key = `report:${ev.event}:${hit.mediaType}:${hit.tmdbId}:${ev.season ?? 0}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        key,
        kind: "report",
        tmdb_id: hit.tmdbId,
        media_type: hit.mediaType,
        /* اسمُ العمل يُملأ من القاعدة أو من العنوان لاحقاً — وهنا نضع
           اسمَ المصدر مؤقّتاً لا، بل اسمَ العمل يأتي من مطابقة TMDB */
        title: "",
        poster_path: null,
        data: {
          event: ev.event,
          ...(ev.season ? { season: ev.season } : {}),
          source: label.slice(0, 40),
          url: it.url,
        },
      });
    }
  }
  return out;
}

/**
 * الدفعةُ كاملة: استخراجٌ ثم **تسميةُ العمل من TMDB** ثم كتابة.
 *
 * **ولماذا نداءٌ ثانٍ للاسم:** العنوانُ الصحفيّ يكتب «Yellowjackets» بينما
 * قد يكون اسمُ العمل عندنا بالعربية — **والجملةُ تُقرأ باسمِ العمل لا
 * باسمِ العنوان**، فيُقرأ الخبرُ متّسقاً مع بقية التطبيق (D-048).
 */
export async function runReportSlice(): Promise<{ found: number; saved: number }> {
  const rows = await collectReports();
  if (!rows.length) return { found: 0, saved: 0 };

  const { getTv, getMovie } = await import("@/lib/tmdb");
  const named: GeneratedPost[] = [];
  for (const r of rows.slice(0, 12)) {
    try {
      if (r.media_type === "tv") {
        const tv = await getTv(r.tmdb_id);
        named.push({ ...r, title: tv.name, poster_path: tv.poster_path ?? null });
      } else {
        const mv = await getMovie(r.tmdb_id);
        named.push({ ...r, title: mv.title, poster_path: mv.poster_path ?? null });
      }
    } catch {
      /* عملٌ تعذّرت تسميتُه لا يُنشر بلا اسم */
    }
  }
  if (!named.length) return { found: rows.length, saved: 0 };

  const supabase = await createClient();
  const { data } = await supabase.rpc("set_news_posts", { p_rows: named });
  return { found: rows.length, saved: Number(data ?? 0) };
}
