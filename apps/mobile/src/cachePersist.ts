import { AppState, InteractionManager } from "react-native";
import { dehydrate, hydrate, type DehydratedState, type Query } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import { queryClient } from "./api";
import { session } from "./session";
import { currentLocale, webLocale } from "./i18n";

/**
 * ====== كاشُ الاستعلامات يعيش بين فتحتين — D-1026 (Phase 11-F · F2) ======
 *
 * **لماذا**: كلُّ إقلاعٍ بارد كان يفتح «المكتبة» على هيكلٍ رماديّ وينتظر الشبكة، مع أنّ
 * ما سيُعرض هو ما عُرض أمس بفارق حلقة. الآن آخرُ ردٍّ ناجحٍ يُكتب في ملفٍّ واحد ويُعاد عند
 * الإقلاع: الشاشةُ ترسم فوراً ثمّ تجدّد نفسَها في الخلفيّة (البياناتُ تعود «قديمة» بطابعها
 * الزمنيّ فيُعاد جلبُها — لا قاعدةَ تجديدٍ ثانية).
 *
 * 🔑 **`dehydrate`/`hydrate` من `react-query` نفسِها فوق `expo-file-system` المثبَّتة** — بلا
 * `persist-client` ولا AsyncStorage/MMKV: تبعيّةٌ أصليّةٌ جديدة بناءٌ جديد، وحزمتان لعملِ ستّين
 * سطراً ثمنٌ بلا مقابل. و`hydrate` لا تكتب فوق بياناتٍ أحدث في الذاكرة، فلا سباقَ مع جلبٍ سبقها.
 *
 * 🔑 **أربعُ عائلاتٍ لا غير**: `me:library` · `discover:view` · `discover:rail` · `discover:personal`
 * — **وبلا فلتر** (المفتاحُ الأخيرُ فارغ): صفوفُ الفلاتر لا حدَّ لعددها. ولا `/me`. (وصفحاتُ الأعمال — آخرُ ثلاثين
 *   بمواسمها — منذ D-1118.)
 *
 * 🔴 **حسابٌ آخر لا يرى هذا الكاش أبداً**:
 *  ١ · الملفُّ يحمل `sub` صاحبه (من الرمز) ونسخةَ العقد (D-1091) ولغتَه وعمرَه (٧ أيام) — اختلافُ
 *      أيٍّ منها عند القراءة ⇒ يُحذف ولا يُقرأ.
 *  ٢ · الخروجُ (`session.signOut`: رسالةُ `session:clear` من الصفحة، أو عنوانُ `/auth/signout`
 *      أو `/login` في الـWebView) ⇒ `queryClient.clear()` وحذفُ الملف **قبل** أن يدخل أحد —
 *      والدخولُ Google وحدَه ويمرّ بـ`/login` حتماً.
 *  ٣ · وأوّلُ رمزٍ يصل بـ`sub` غيرِ صاحب الملف ⇒ المسحُ نفسُه (حزامٌ ثانٍ).
 *  ⚖️ **`session.clear()` العاديّةُ لا تمسح**: الرمزُ يشيخ كلَّ ساعة ويُمسح بعد خمس دقائق في
 *  الخلفيّة — وهذا ليس خروجاً؛ لو مسحنا معه لما عاش الكاشُ يوماً.
 *  ٤ · تبدّلُ اللغة ⇒ حذفُ الملف وإبطالُ العائلات الأربع فتُجلب بلغتها.
 */
/* 🆕 D-1083 — و`home` و`home:extras`: الرئيسيّةُ الأصليّة صارت شاشةَ الإقلاع (D-1075)، فتُرسم من
   آخر حمولةٍ محفوظة فورَ الفتح ثمّ تتجدّد حين يصل الرمز — بدل هيكلٍ فارغٍ ينتظر الجلسة. الملكيّةُ
   والعمرُ والإصدارُ واللغةُ تُفحص كما لأخواتها، والخروجُ يمسحها معها */
const FAMILIES = new Set(["me:library", "discover:view", "discover:rail", "discover:personal", "home", "home:extras", "discover:trailers", "discover:lists"]);
/* D-1091 — **سبعةُ أيام لا يوم، ونسخةُ العقد لا نسخةُ التطبيق** (أحمد: الفتحُ الأوّل بعد كلِّ تحديثٍ
   يعود دوّامةً): كان الملفُّ يُرفض إن اختلف `app.json` أو مضى يوم — فكلُّ إصدارٍ (وهي شبهُ يوميّة) يعيد
   الهيكلَ الفارغ. الهيكلُ لا يتغيّر بتغيّر الإصدار بل بتغيّر **عقود** الحمولات المحفوظة؛ فالمفتاحُ
   الآن `CACHE_SCHEMA` **ويُرفع باليد** مع أيِّ تغييرٍ في عقود `home` · `home:extras` · `me:library` ·
   `discover:*` (`src/core/contracts`). والبياناتُ تعود «قديمة» بطابعها فتُجلب من جديد فوراً كما كانت. */
const CACHE_SCHEMA = "2026-09-24";
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;
/* ⚖️ مراجعةُ ما قبل الرفع (D-1026): الكتابةُ `dehydrate` + `JSON.stringify` لمكتبةٍ كاملة + كتابةُ ملفٍّ
   **متزامنة** على خيط JS. بخنقِ ثانيةٍ واحدة كانت تقع مرّتين أو ثلاثاً **في أثناء فتح «اكتشف»**
   (صفوفُه تصل تباعاً) والإصبعُ يمرّر — والحزمةُ كلُّها لأجل السلاسة. فصارت: **هدوءٌ ٤ ثوانٍ بعد
   آخر وصول** (وسقفٌ ٢٠ ثانية كي لا تؤجَّل إلى الأبد)، **وبعد انتهاء الإيماءات والحركات**، وفوراً
   عند نزول التطبيق إلى الخلفيّة — وهي اللحظةُ التي يهمّ فيها الملفُّ فعلاً. */
const WRITE_QUIET_MS = 4_000;
const WRITE_MAX_WAIT_MS = 20_000;

type Stored = { v: string; sub: string; locale: string; at: number; state: DehydratedState };

const file = () => new File(Paths.document, "query-cache.json");

/** صاحبُ الكاش الذي في الذاكرة الآن — من ملفٍّ أُعيد، أو من أوّل رمز */
let owner: string | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let dirtySince = 0;

/* 🆕 D-1118 — **صفحاتُ الأعمال ومواسمُها تُحفظ، آخرُ ثلاثين عملاً فُتح لا كلُّها** (أحمد: «التحميل بطيء إذا دخلت
   البوستر… وظهور السيزون»): كانت خارج الملفّ عمداً («لا صفحاتِ أعمال») خشيةَ أن يكبر بلا سقف — **والسقفُ يحلّ
   ذلك**. الفتحُ الثاني لعملٍ فُتح أمس يرسم فوراً ثمّ يتجدّد كأخواته، والموسمُ المفتوحُ يبدأ جلبُه مع الصفحة لا بعدها.
   الموسمُ بتقييمات IMDb (`r`) لا يُحفظ — رحلةٌ اختياريّة. ⚠️ عقدُ `title`/`season` صار محفوظاً: غيّره ⇒ ارفع `CACHE_SCHEMA`. */
const TITLES_KEPT = 30;
let keptTitles = new Set<string>();

function pickRecentTitles() {
  const latest = new Map<string, number>();
  for (const q of queryClient.getQueryCache().getAll()) {
    const k = q.queryKey[0];
    if (typeof k !== "string" || !k.startsWith("title:") || q.state.status !== "success") continue;
    latest.set(k, Math.max(latest.get(k) ?? 0, q.state.dataUpdatedAt));
  }
  keptTitles = new Set([...latest.entries()].sort((a, b) => b[1] - a[1]).slice(0, TITLES_KEPT).map(([k]) => k));
}

function persistable(q: Query, checkKept = true): boolean {
  const key = q.queryKey;
  if (q.state.status !== "success" || typeof key[0] !== "string") return false;
  if (key[0].startsWith("title:")) {
    if (checkKept && !keptTitles.has(key[0])) return false;
    /* `[title:k:id]` الصفحة · `[title:tv:id, "season", n, ""]` الموسمُ بلا تقييمات — لا الإضافاتُ ولا المجتمع */
    return key.length === 1 || (key[1] === "season" && key[3] === "");
  }
  if (!FAMILIES.has(key[0])) return false;
  /* `discover:rail` ⇒ [_, tab, key, bq] · `discover:personal` ⇒ [_, tab, bq] — الفلترُ لا يُحفظ */
  if (key[0] === "discover:rail") return key[3] === "";
  if (key[0] === "discover:personal") return key[2] === "";
  return true;
}

/** `sub` من حمولة الرمز — يُقرأ ولا يُتحقَّق: الخادمُ هو من يتحقّق، وهنا مفتاحُ ملكيّةٍ لا صلاحيّة */
function subOf(token: string | null): string | null {
  if (!token) return null;
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(globalThis.atob(b64)) as { sub?: unknown };
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

function dropFile() {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    /* ملفٌّ لم يُحذف يُرفض عند القراءة بصاحبه وعمره */
  }
}

export function forgetCache() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  dirtySince = 0;
  owner = null;
  queryClient.clear();
  dropFile();
}

function writeNow() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  if (!owner || !dirtySince) return;
  dirtySince = 0;
  try {
    pickRecentTitles();
    const state = dehydrate(queryClient, { shouldDehydrateQuery: (q) => persistable(q) });
    const body: Stored = { v: CACHE_SCHEMA, sub: owner, locale: currentLocale(), at: Date.now(), state };
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify(body));
  } catch {
    /* كتابةٌ ضاعت تعني هيكلاً رماديّاً في الفتح القادم — كما كان قبل F2 */
  }
}

let started = false;
/** يُنادى مرّةً من الجذر قبل أوّل شاشة: يعيد الملفَّ إن صحّ، ثمّ يبدأ الحفظ */
export function startCachePersist() {
  if (started) return;
  started = true;

  /* العائلاتُ المحفوظة تعيش في الذاكرة بقدر ما تعيش في الملفّ — وإلّا جُمعت بعد خمس دقائق من
     مغادرة شاشتها فخرجت من الكتابة التالية */
  for (const fam of FAMILIES) queryClient.setQueryDefaults([fam], { gcTime: MAX_AGE_MS });

  void (async () => {
    try {
      const f = file();
      if (!f.exists) return;
      const s = JSON.parse(await f.text()) as Partial<Stored>;
      const ok = s.v === CACHE_SCHEMA && s.locale === currentLocale() && typeof s.sub === "string" && typeof s.at === "number" && Date.now() - s.at <= MAX_AGE_MS && !!s.state;
      /* رمزٌ وصل قبل انتهاء القراءة يحسم الملكيّةَ هنا لا بعدها */
      if (!ok || (owner !== null && owner !== s.sub)) {
        dropFile();
        return;
      }
      owner = s.sub as string;
      hydrate(queryClient, s.state as DehydratedState);
    } catch {
      dropFile();
    }
  })();

  session.subscribe(() => {
    const sub = subOf(session.get());
    if (!sub) return;
    if (owner !== null && owner !== sub) forgetCache();
    owner = sub;
  });
  session.onSignOut(forgetCache);

  webLocale.subscribe(() => {
    dropFile();
    for (const fam of FAMILIES) void queryClient.invalidateQueries({ queryKey: [fam] });
  });

  queryClient.getQueryCache().subscribe((e) => {
    /* الثلاثون تُحسب عند الكتابة؛ هنا يكفي أن يكون الشكلُ محفوظاً — عملٌ فُتح للتوّ هو أحدثُها */
    if (e.type !== "updated" || e.action.type !== "success" || !persistable(e.query, false)) return;
    const now = Date.now();
    if (!dirtySince) dirtySince = now;
    if (writeTimer) clearTimeout(writeTimer);
    const wait = Math.max(0, Math.min(WRITE_QUIET_MS, dirtySince + WRITE_MAX_WAIT_MS - now));
    writeTimer = setTimeout(() => {
      writeTimer = null;
      InteractionManager.runAfterInteractions(writeNow);
    }, wait);
  });

  AppState.addEventListener("change", (st) => {
    if (st !== "active") writeNow();
  });
}
