/*
 * Loopz Service Worker — قشرة تطبيقٍ للفتح الفوري.
 *
 * التطبيق قابل للتثبيت كـPWA، وكان كل فتحٍ من أيقونة الشاشة يدفع كلفة
 * شبكةٍ كاملة قبل أول بكسل. الاستراتيجية هنا محافظة عمداً:
 *
 *  - أصول البناء المبصومة (/_next/static/): cache-first — لا تتغيّر أبداً
 *    تحت نفس الاسم، فطلبها ثانيةً هدرٌ صافٍ.
 *  - الصور (ملصقات TMDB عبر /_next/image والأعلام): stale-while-revalidate
 *    بسقفِ عددٍ — تظهر فوراً من الكاش وتتجدّد بصمت.
 *  - التنقّل (HTML): network-first مع navigation preload — الشبكة أولاً
 *    حتى تبقى البيانات الشخصية طازجة، والكاش احتياطُ الانقطاع فقط.
 *
 * طلبات RSC للتنقّل داخل التطبيق ليست mode=navigate فلا نلمسها —
 * راوتر Next يديرها بنفسه.
 */

// رقم النسخة يُرفع مع أي تغييرٍ في قشرة التطبيق: مُعالج `activate` يمسح
// كل كاشٍ لا يبدأ به، فالتطبيق المثبّت لا يبقى على قشرةٍ قديمة.
/* ⚖️ 🆕 v9 (D-652): رُفع الرقمُ ليمسح `activate` كلَّ كاشٍ قديمٍ على
   الأجهزة المسمومة الآن — **وهو العلاجُ الوحيدُ لما فسد قبل هذا
   السطر.** **وما بعده لا يحتاج رفعاً**: حزامُ البناء أدناه يمسح كاشَ
   الصفحات من تلقائه عند كلِّ نشرة. */
const VER = "loopz-v9";
const STATIC_CACHE = `${VER}-static`;
const PAGE_CACHE = `${VER}-pages`;
const IMG_CACHE = `${VER}-img`;
/* 🆕 v6: كاشٌ صغيرٌ لبياناتٍ وصفية — اليوم مدخلٌ واحد: «مالكُ كاش
   الصفحات» (تسمية `x-lz-owner` من الخادم — D-514). */
const META_CACHE = `${VER}-meta`;
const IMG_LIMIT = 300;

/* أصولُ شاشة الإقلاع تُخزَّن مسبقاً عند التثبيت: الشعارُ يجب أن يظهر
   من الكاش قبل أن تصل الشبكةُ أصلاً — وهو معنى «شاشة إقلاعٍ فوريّة».
   القائمةُ قصيرةٌ عمداً: ما يلزم أوّلَ إطارٍ لا أكثر. */
const LAUNCH_ASSETS = ["/loopz-wordmark.png", "/loopz-mark.png", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(LAUNCH_ASSETS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VER)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  // الأقدم أولاً — ترتيب keys يعكس ترتيب الإدخال
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) {
        cache.put(request, res.clone()).then(() => trim(cache, IMG_LIMIT));
      }
      return res;
    })
    .catch(() => undefined);
  return hit ?? (await refresh) ?? Response.error();
}

/* 🆕 v5 (جولة أداء ٢٠ أغسطس): سقفُ انتظارٍ للشبكة البطيئة.
   الشبكة تبقى أولاً — البيانات الشخصية طازجة — لكن اتصالاً يزحف
   (3G مثقل، شبكة فندق) كان يحبس الفتح بلا سقف رغم أن نسخة الصفحة
   نفسِها محفوظة. الآن: إن لم يصل أول بايت خلال المهلة **وعندنا نسخة
   لنفس الرابط بالضبط** نعرضها فوراً، ويكمل الجلبُ في الخلفية ليجدّد
   الكاش للفتحة التالية. لا مهلة لمن لا نسخة عنده — الانتظار حينها
   خير من خطأ. */
const NAV_TIMEOUT_MS = 3500;

/* ===== 🆕 v6 — «مالكُ الكاش» (D-514): كاشُ الصفحات لا يخدم إلا صاحبَه =====

   🔴 العطل الذي أغلقه (بلاغُ أحمد بقراءة الكود، وثبت بالفحص): مسحُ
   الكاش عند الخروج كان فرعاً ميّتاً — تسجيلُ الخروج **POST** ومعالجُ
   fetch كان يبدأ بـ`if (method !== "GET") return` قبل فحص المسار،
   فبقيت صفحاتُ الحساب السابق محفوظةً بعد خروجه.

   والإصلاح طبقتان لا واحدة:
   ١) فرعُ الخروج صعد **فوق** حارس الطريقة في معالج fetch — فأيُّ
      طلبٍ لمسار الخروج، بأيِّ طريقة، يمسح كاشَ الصفحات والمالك.
   ٢) **حزامُ الهويّة** — لا اعتمادَ على رابطٍ واحد: الوسيطُ يسمّي كلَّ
      ردٍّ بمالكه (`x-lz-owner`: بادئة sub أو anon)، ونحفظ آخرَ تسميةٍ
      هنا؛ فأوّلُ ردٍّ ناجحٍ بتسميةٍ مختلفة (دخولُ حسابٍ آخر، انتهاءُ
      جلسةٍ، أيُّ طريقِ خروجٍ مستقبليّ) يمسح كاشَ الصفحات كلَّه قبل أن
      يُكتب فيه سطر. وتبديلُ الحساب يقتضي شبكةً (OAuth) — فبحلول أيِّ
      لحظة أوفلاين يكون الحزامُ قد نظّف ما ليس لصاحب الجلسة الحاليّ. */
const OWNER_HEADER = "x-lz-owner";
const OWNER_KEY = "/__lz-owner";

/* ===== 🆕 v9 — «حزامُ البناء» (D-652): قشرةٌ من نشرةٍ ماضية لا تُخدَم =====

   🔴 **العطلُ الذي أغلقه** (بلاغُ أحمد: «ما زال حساب mesh ما يفتح
   البروفايل»، وهو عودةُ D-626): **اسمُ كاش الصفحات ثابتٌ بيدٍ**
   (`VER`) **فيعيش عبر النشرات كلِّها** — **وصفحةُ HTML محفوظةٌ من
   نشرةِ أمس تُقلع راوترَ Next ببصمةِ أمس**، فأوّلُ طلبِ حمولةِ RSC
   يذهب ببناءٍ لم يعد قائماً **فتسقط الشاشةُ إلى حدِّ الخطأ.**
   **ورفعُ الرقم بيدٍ ليس علاجاً**: نشرةٌ واحدةٌ يُنسى فيها الرفعُ
   تعيد العطلَ كلَّه — **وقد نُشر اليوم وحدَه ثماني مرّات.**

   🔑 **والآليّةُ آليّةُ المالك بحرفها** (D-514/D-145): تسميةٌ على
   الردّ، وأوّلُ ردٍّ يخالف المحفوظَ يمسح **قبل** أن يُكتب سطر —
   **قارئٌ ثانٍ لفكرةٍ قائمة لا آليّةٌ ثانية.**

   ⚠️ **والمسحُ لكاش الصفحات وحدَه**: أصولُ `/_next/static/` مبصومةٌ
   بمحتواها **فلا تكذب أبداً**، والصورُ لا علاقةَ لها ببناء. */
const BUILD_HEADER = "x-lz-build";
const BUILD_KEY = "/__lz-build";

async function currentOwner() {
  try {
    const c = await caches.open(META_CACHE);
    const r = await c.match(OWNER_KEY);
    return r ? await r.text() : null;
  } catch {
    return null;
  }
}

async function currentBuild() {
  try {
    const c = await caches.open(META_CACHE);
    const r = await c.match(BUILD_KEY);
    return r ? await r.text() : null;
  } catch {
    return null;
  }
}

/* يُستدعى على كلِّ ردِّ تنقّلٍ وصل من الشبكة — قبل أيِّ كتابةٍ للكاش.
   ⚠️ **ولا يمسح `META_CACHE`**: فيه تسميةُ المالك، **ونشرةٌ جديدةٌ
   ليست تبديلَ حساب** — ومسحُها كان سيُفقد الحزامَ الآخرَ ذاكرتَه. */
async function reconcileBuild(res) {
  try {
    const build = res.headers.get(BUILD_HEADER);
    if (!build) return; // ردٌّ بلا بصمة (نشرةٌ أقدم/أصلٌ ساكن) — لا حكم
    const prev = await currentBuild();
    if (prev === build) return;
    if (prev !== null) await caches.delete(PAGE_CACHE);
    const c = await caches.open(META_CACHE);
    await c.put(BUILD_KEY, new Response(build));
  } catch {
    /* الحزامُ احتياطٌ — فشلُه لا يمسّ الردّ نفسه */
  }
}

async function purgePersonalCaches() {
  await Promise.all([caches.delete(PAGE_CACHE), caches.delete(META_CACHE)]);
}

/* يُستدعى على كلِّ ردِّ تنقّلٍ وصل من الشبكة — قبل أيِّ كتابةٍ للكاش */
async function reconcileOwner(res) {
  try {
    const owner = res.headers.get(OWNER_HEADER);
    if (!owner) return; // ردٌّ بلا تسمية (نشرة أقدم/كاش CDN) — لا حكم
    const prev = await currentOwner();
    if (prev === owner) return;
    if (prev !== null) await purgePersonalCaches();
    const c = await caches.open(META_CACHE);
    await c.put(OWNER_KEY, new Response(owner));
  } catch {
    /* الحزامُ احتياطٌ — فشلُه لا يمسّ الردّ نفسه */
  }
}

async function pageNetworkFirst(event) {
  const fetching = (async () => {
    const preload = await event.preloadResponse;
    const res = preload ?? (await fetch(event.request));
    if (res) {
      /* المصالحةُ قبل الكتابة: لو تغيّر المالكُ يُمسح القديم أولاً،
         ثم يُفتح الكاشُ من جديد فلا نكتب في مقبضٍ محذوف */
      await reconcileOwner(res);
      /* **والبناءُ بعد المالك**: كلاهما قد يمسح كاشَ الصفحات، **والفتحُ
         يأتي بعدهما** فلا نكتب في مقبضٍ محذوف. */
      await reconcileBuild(res);
      if (res.ok) {
        const cache = await caches.open(PAGE_CACHE);
        cache.put(event.request, res.clone());
      }
    }
    return res;
  })();

  const same = await (await caches.open(PAGE_CACHE)).match(event.request);
  if (same) {
    // نسخةٌ موجودة: الشبكة أولاً حتى المهلة، وبعدها المحفوظ فوراً
    const timer = new Promise((resolve) =>
      setTimeout(() => resolve(null), NAV_TIMEOUT_MS),
    );
    const res = await Promise.race([fetching.catch(() => null), timer]);
    if (res) return res;
    // الجلبُ يكمل في الخلفية فيتجدّد الكاش دون أن ننتظره
    event.waitUntil(fetching.catch(() => {}));
    return same;
  }

  try {
    return await fetching;
  } catch {
    // انقطاع بلا نسخةٍ لنفس الصفحة: الرئيسية المحفوظة، وإلا خطأ الشبكة
    const home = await (await caches.open(PAGE_CACHE)).match("/");
    if (home) return home;
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* 🔴 v6: تسجيلُ الخروج **قبل** حارس الطريقة — الخروجُ POST (نموذجُ
     `SignOutRow`)، وكان الحارسُ يعيدنا قبل بلوغ هذا الفرع فلا يُمسح
     شيء (البلاغُ الذي فتح D-514). لا `respondWith` هنا: الطلبُ يمضي
     إلى الخادم كما هو، وتحويلةُ `/login` لا تُمسّ — نمسح في الظلّ
     كاشَ الصفحات الشخصيّ وتسميةَ مالكه معاً. */
  if (sameOrigin && url.pathname === "/auth/signout") {
    event.waitUntil(purgePersonalCaches());
    return;
  }

  if (req.method !== "GET") return;

  if (sameOrigin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  /* الخطوطُ وأصولُ الإقلاع والعلامة: cache-first — لا تتغيّر إلا مع
     نشرةٍ ترفع رقمَ النسخة أعلاه فيمسحها `activate` كلَّها. وبها يرتسم
     شعارُ الإقلاع والخطُّ العربيُّ بلا رحلة شبكةٍ واحدة في كل فتحة. */
  if (
    sameOrigin &&
    (url.pathname.startsWith("/fonts/") ||
      url.pathname.startsWith("/splash/") ||
      LAUNCH_ASSETS.includes(url.pathname))
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (
    (sameOrigin && url.pathname.startsWith("/_next/image")) ||
    url.hostname === "image.tmdb.org" ||
    url.hostname === "flagcdn.com"
  ) {
    event.respondWith(staleWhileRevalidate(req, IMG_CACHE));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(pageNetworkFirst(event));
  }
});
