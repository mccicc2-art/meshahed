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
const VER = "loopz-v3";
const STATIC_CACHE = `${VER}-static`;
const PAGE_CACHE = `${VER}-pages`;
const IMG_CACHE = `${VER}-img`;
const IMG_LIMIT = 300;

self.addEventListener("install", () => {
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

async function pageNetworkFirst(event) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const preload = await event.preloadResponse;
    const res = preload ?? (await fetch(event.request));
    if (res && res.ok) cache.put(event.request, res.clone());
    return res;
  } catch {
    // انقطاع: نفس الصفحة من الكاش، وإلا الرئيسية، وإلا خطأ الشبكة الأصلي
    const same = await cache.match(event.request);
    if (same) return same;
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
