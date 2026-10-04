import type { QueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ApiError, api, qk, softGet } from "../api";
import { flag } from "../flags";
import { seasonQuery } from "./SeasonAccordion";
import { backdropUrl } from "@/core/media";
import type { LibraryPayload, TitlePayload, TitleTrailerPayload } from "../contracts";

/**
 * 🆕 D-1221 — **رأسُ صفحة العمل من البطاقة التي فُتح منها** (تسجيلُ أحمد ١ أكتوبر: «الدخول لأيّ صفحة فلم فيه تأخير خفيف»).
 *
 * 🔑 **المشكلة**: صفحةُ العمل الباردة تنتظر `/api/v1/title` (~٨٠٠ms وسيطاً، `title.open` cached=0) وتعرض هيكلاً رماديّاً
 * فارغاً — **والاسمُ والملصقُ معروفان قبل أيِّ نداء**: البطاقةُ التي ضُغطت كانت ترسمهما من كاش `react-query` نفسِه.
 * 🔑 **لماذا بحثٌ في الكاش لا معاملٌ في الرابط**: الأبوابُ إلى صفحة العمل ١٩ (اكتشف · المكتبة · الرئيسيّة · البحث · الملفّ ·
 * القائمة · النقاش · الرسائل…) — **ومعاملٌ يُمرَّر في كلٍّ منها يُنسى في العشرين**. الكاشُ يحمل كلَّ بطاقةٍ رُسمت، بالحقول نفسِها
 * (`kind`/`media_type` · `id` · `title`/`name` · `poster_path`)، فالبحثُ مرّةً عند فتح الصفحة يكفي الأبوابَ كلَّها.
 * ⚠️ **الجهةُ شرطٌ لا تخمين**: معرّفاتُ TMDB تتكرّر بين الأفلام والمسلسلات — كائنٌ بلا `kind`/`media_type` لا يُؤخذ.
 * ⚠️ **سقفٌ للمسح** (عمقٌ ٧ · ٢٠٠٠٠ عقدة): الكاشُ قد يكبر، والبحثُ مرّةً عند الفتح لا يجوز أن يكلّف إطاراً.
 *
 * 🆕 D-1224 — **البطاقتان تسلّمان بذرتَهما لحظةَ اللمس** (`primeTitle` من `onPressIn`): تسجيلُ أحمد بعد #39 أظهر ~٢٩٠ms بين
 * الضغطة وبدء الانزلاق — وفيها المسحُ أعلاه يجري على خيط JS قبل أوّل رسمٍ للصفحة، والنظامُ لا يبدأ الحركةَ قبله. البذرةُ المسلَّمة
 * تُقرأ من خريطةٍ بلا مسح، **والمسحُ يبقى احتياطاً** للأبواب التي لا تمرّ بالبطاقتين. وإصبعٌ يثبت ٩٠ms يبدأ جلبَ العمل والخلفيّة
 * (D-1226) قبل رفعه؛ وفي الضغطة الأقصر تبدأ الخلفيّةُ مع أوّل رسمٍ للصفحة من البذرة — لا بعد وصول العمل كما كانت.
 */
export type TitleSeed = { name: string; poster_path: string | null; backdrop_path: string | null };

const MAX_NODES = 20_000;
const MAX_DEPTH = 7;

/**
 * 🆕 D-1232 — **طلبٌ معلَّقٌ لا يُترك بلا نهاية** (تسجيلُ أحمد مساء ١ أكتوبر: ثلاثةُ أفلامٍ متتالية بقيت صفحتُها على الهيكل
 * ٨ ثوانٍ وأكثر، بعد أفلامٍ فُتحت فوراً). `fetch` في RN بلا مهلة، وطلبٌ علق في الشبكة يُبقي الاستعلامَ «يجلب» إلى الأبد —
 * فلا خطأَ يظهر ولا إعادةَ محاولة. بعد المهلة **يُقطع الطلبُ** (`AbortController`) ويُرمى خطأٌ فيعيد `react-query` المحاولةَ مرّةً (`retry: 1`)
 * بطلبٍ جديدٍ بعد ٣٠٠ms، وإن فشلت ظهر «حاول مجدداً» (`TitleFailure`). ⚖️ ٨ث: الباردُ ~٨٠٠ms وسيطاً — عشرةُ أضعافه طلبٌ
 * علق لا طلبٌ بطيء، وأسوأُ انتظارٍ قبل الزرّ ~١٦ث بدل «إلى الأبد».
 */
const TITLE_TIMEOUT_MS = 8_000;
function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, outer?: AbortSignal): Promise<T> {
  const ctl = new AbortController();
  /* استعلامٌ أُلغي (غادر صاحبُه قبل الردّ) يقطع الطلبَ أيضاً */
  const onOuter = () => ctl.abort();
  outer?.addEventListener("abort", onOuter);
  return new Promise<T>((resolve, reject) => {
    /* المهلةُ ترفض بنفسها ولا تنتظر الطلب: ما قبل `fetch` (الرمزُ من الجلسة) قد يعلق أيضاً، والقطعُ لا يبلغه */
    const t = setTimeout(() => {
      ctl.abort();
      reject(new ApiError({ code: "upstream", message_key: "apiUpstream" }, 0));
    }, TITLE_TIMEOUT_MS);
    run(ctl.signal)
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(t);
        outer?.removeEventListener("abort", onOuter);
      });
  });
}

/**
 * 🩺 D-1261 — مراحلُ الخادم لآخر جلبٍ لكلِّ عمل (ترويسة `X-Loopz-T`) مع مدّة الطلب من الجهاز، تُلصق بعلامة
 * `title.open` الباردة فيُقرأ الطرفان معاً: الشبكةُ = `rq − sv`. قياسٌ فقط؛ الخريطةُ تُفرغ عند القراءة ولا تكبر.
 */
export type ServerTiming = { rq: number; sv?: number; sa?: number; st?: number; sr?: number; sd?: number };
const timings = new Map<string, ServerTiming>();
const T_KEYS: Record<string, "sv" | "sa" | "st" | "sr" | "sd"> = { all: "sv", a: "sa", t: "st", r: "sr", d: "sd" };

function keepTiming(kind: "tv" | "movie", id: number, t0: number, res: Response) {
  const out: ServerTiming = { rq: Math.round(performance.now() - t0) };
  for (const part of (res.headers.get("x-loopz-t") ?? "").split(",")) {
    const [k, v] = part.split("=");
    const key = T_KEYS[k];
    const n = Number(v);
    if (key && v !== undefined && v !== "" && Number.isFinite(n) && n >= 0) out[key] = n;
  }
  if (timings.size >= 30) timings.clear();
  timings.set(`${kind}:${id}`, out);
}

/** يأخذ القياسَ مرّةً واحدة — الفتحةُ التالية للعمل نفسِه من الكاش لا تحمل أرقامَ جلبٍ قديم */
export function takeTiming(kind: "tv" | "movie", id: number): ServerTiming | null {
  const k = `${kind}:${id}`;
  const t = timings.get(k) ?? null;
  timings.delete(k);
  return t;
}

/** الجالبُ الواحدُ لصفحة العمل — `TitleScreen` واللمسةُ المسبقة يتشاركانه فلا يفترق مفتاحٌ ولا عنوان */
export const titleQuery = (kind: "tv" | "movie", id: number) => ({
  queryKey: qk.title(kind, id),
  /* D-1141 — العملُ عامٌّ: لا ينتظر الرمز؛ حالتي تلحق حين يصل (`useGuestUpgrade`) */
  queryFn: ({ signal }: { signal?: AbortSignal }) => {
    const t0 = performance.now();
    return withTimeout((s) => softGet<TitlePayload>(`/api/v1/title/${kind}/${id}${flag("tx") ? "?t=0" : ""}`, s, (res) => keepTiming(kind, id, t0, res)), signal);
  },
  staleTime: 60_000,
  retryDelay: 300,
});

/**
 * 🆕 D-1262 — **الإعلانُ يُطلب وحدَه بالتوازي مع الصفحة** (خلف `tx`): القياسُ (D-1261) أظهر أنّ ردَّ الصفحة كان ينتظره
 * ١١٥–٥٥٠ms فوق التفاصيل في نحو ثلث الفتحات الباردة. عامٌّ بلا هويّة (`auth: false`) فلا ينتظر رمزاً، وفشلُه صمتٌ —
 * الصفحةُ بلا بطاقة إعلانٍ كما لو لم يكن للعمل إعلان. واللمسةُ المسبقةُ تبدؤه مع العمل (`primeTitle`).
 */
export const trailerQuery = (kind: "tv" | "movie", id: number) => ({
  queryKey: ["title:trailer", kind, id] as const,
  queryFn: async ({ signal }: { signal?: AbortSignal }) => (await api<TitleTrailerPayload>(`/api/v1/title/${kind}/${id}/trailer`, { auth: false, signal })).data,
  staleTime: 5 * 60_000,
  retry: 1,
});

/** بذورٌ سلّمتها بطاقاتٌ لُمست — قليلةٌ ومقصوصة (آخرُ ٣٠)، فلا تكبر مع الجلسة */
const handoff = new Map<string, TitleSeed>();
const HANDOFF_MAX = 30;

/**
 * 🆕 D-1224/D-1226 — **لمسُ بطاقةٍ يجهّز صفحتَها**: يسلّم الاسمَ والملصقَ والخلفيّة، ويبدأ جلبَ العمل (إن لم يكن طازجاً في
 * الكاش) وتحميلَ الخلفيّة. ⚖️ اللمسُ قد يكون بدايةَ تمريرٍ لا ضغطة — فالنداءُ ينتظر أن يثبت الإصبع
 * (`PRIME_HOLD_MS`)، و`staleTime` يمنع تكرارَه للبطاقة نفسِها، والخلفيّةُ تُحمَّل مرّةً (`memory-disk`).
 */
type PrimeCard = { kind: "tv" | "movie"; id: number; title: string; poster_path: string | null; backdrop_path?: string | null };
let primeTimer: ReturnType<typeof setTimeout> | null = null;
/** إصبعٌ ثبت هذه المدّةَ على البطاقة ضغطةٌ لا بدايةُ تمرير (التمريرُ يسحب اللمسَ قبلها) — فلا نداءَ لكلِّ بطاقةٍ مرّ عليها الإصبع */
const PRIME_HOLD_MS = 90;

/** 🆕 D-1224 — لحظةُ آخر لمسةٍ لبطاقة (لقياس `title.tap`) */
let lastPress: { key: string; at: number } | null = null;
export function takePress(kind: "tv" | "movie", id: number): number | null {
  const p = lastPress;
  lastPress = null;
  return p && p.key === `${kind}-${id}` && performance.now() - p.at < 3000 ? p.at : null;
}

export function primeTitle(qc: QueryClient, c: PrimeCard) {
  const key = `${c.kind}-${c.id}`;
  lastPress = { key, at: performance.now() };
  /* البذرةُ فوراً: قراءةُ خريطةٍ لا نداء */
  if (!handoff.has(key)) {
    handoff.set(key, { name: c.title, poster_path: c.poster_path, backdrop_path: c.backdrop_path ?? null });
    if (handoff.size > HANDOFF_MAX) handoff.delete(handoff.keys().next().value as string);
  }
  if (primeTimer) clearTimeout(primeTimer);
  primeTimer = setTimeout(() => {
    primeTimer = null;
    void qc.prefetchQuery(titleQuery(c.kind, c.id));
    if (flag("tx")) void qc.prefetchQuery(trailerQuery(c.kind, c.id));
    const bd = c.backdrop_path ? backdropUrl(c.backdrop_path, "w780") : null;
    if (bd) void Image.prefetch(bd, "memory-disk");
  }, PRIME_HOLD_MS);
}

/** رفعُ الإصبع أو سحبُ التمرير للّمس: ما لم يبدأ لا يبدأ — الضغطةُ القصيرة تفتح الصفحةَ وهي تجلب بنفسها */
export function unprimeTitle() {
  if (primeTimer) clearTimeout(primeTimer);
  primeTimer = null;
}

/** مصدرُ آخر بذرة — يُكتب مع `title.tap` ليُعرف أيُّ الطريقين كلّف */
let lastSeedSrc: "hand" | "scan" | "none" = "none";
export const seedSrc = () => lastSeedSrc;

export function titleSeed(qc: QueryClient, kind: "tv" | "movie", id: number): TitleSeed | null {
  const handed = handoff.get(`${kind}-${id}`);
  lastSeedSrc = handed ? "hand" : "scan";
  if (handed) return handed;
  let seen = 0;
  const hit = (o: Record<string, unknown>): TitleSeed | null => {
    if (o.id !== id) return null;
    const k = typeof o.kind === "string" ? o.kind : typeof o.media_type === "string" ? o.media_type : null;
    if (k !== kind) return null;
    const name = [o.display_title, o.title, o.name].find((v): v is string => typeof v === "string" && v.length > 0);
    if (!name) return null;
    return {
      name,
      poster_path: typeof o.poster_path === "string" ? o.poster_path : null,
      backdrop_path: typeof o.backdrop_path === "string" ? o.backdrop_path : null,
    };
  };
  const walk = (v: unknown, depth: number): TitleSeed | null => {
    if (!v || typeof v !== "object" || depth > MAX_DEPTH || seen > MAX_NODES) return null;
    seen++;
    if (Array.isArray(v)) {
      for (const x of v) {
        const r = walk(x, depth + 1);
        if (r) return r;
      }
      return null;
    }
    const o = v as Record<string, unknown>;
    const h = hit(o);
    if (h) return h;
    for (const key in o) {
      const r = walk(o[key], depth + 1);
      if (r) return r;
    }
    return null;
  };
  for (const q of qc.getQueryCache().getAll()) {
    const r = walk(q.state.data, 0);
    if (r) return r;
  }
  lastSeedSrc = "none";
  return null;
}

/**
 * 🆕 D-1221 — **حلقاتُ الموسم الأوّل تُطلب مع الصفحة لا بعدها** حين لا يتابعه صاحبُه أو لم يشاهد منه شيئاً: كانت تُطلب بعد وصول
 * ردّ العمل (`firstOpenSeason` يحتاجه) ⇒ ~٨٠٠ms ثمّ ~٦٥٠ms (`season.open` cached=0) على التوالي. ولمن لم يشاهد شيئاً
 * `firstOpenSeason` = أوّلُ موسمٍ بُثّ — الأوّلُ في الغالب. **وإن خالف** (موسمٌ أوّلُ لم يُبثّ) فالأثرُ القائم يطلب الصحيح بعده:
 * الخسارةُ نداءٌ زائد، والربحُ في الغالب ~٦٠٠ms.
 */
export function prefetchFirstSeason(qc: QueryClient, id: number) {
  const lib = qc.getQueryData<LibraryPayload>(qk.tag("me:library"));
  const mine = lib?.items.find((x) => x.kind === "tv" && x.id === id);
  if (mine && mine.watched > 0) return;
  void qc.prefetchQuery(seasonQuery(id, 1));
}
