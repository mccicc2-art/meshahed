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
const VER = "loopz-v5";
const STATIC_CACHE = `${VER}-static`;
const PAGE_CACHE = `${VER}-pages`;
const IMG_CACHE = `${VER}-img`;
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
   خير من خطأ. ولا نسخةَ مستخدمٍ آخر أبداً: الكاش يُمحى عند الخروج. */
const NAV_TIMEOUT_MS = 3500;

async function pageNetworkFirst(event) {
  const cache = await caches.open(PAGE_CACHE);
  const fetching = (async () => {
    const preload = await event.preloadResponse;
    const res = preload ?? (await fetch(event.request));
    if (res && res.ok) cache.put(event.request, res.clone());
    return res;
  })();

  const same = await cache.match(event.request);
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
    const home = await cache.match("/");
    if (home) return home;
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

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

  /* تسجيلُ الخروج يمحو كاشَ الصفحات الشخصيّ: HTML محفوظٌ لحسابٍ خرجت
     منه يجب ألّا يظهر لحسابٍ يدخل بعده — ولا اختلاطَ بين مستخدمين. */
  if (sameOrigin && url.pathname === "/auth/signout") {
    event.waitUntil(caches.delete(PAGE_CACHE));
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
