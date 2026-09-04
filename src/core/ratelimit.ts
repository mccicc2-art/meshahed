// حاجز بسيط لمعدّل الطلبات لكل مستخدم.
//
// الذاكرة هنا محلية لكل نسخة من الدالة على Vercel، فهو ليس حاجزاً موزّعاً
// دقيقاً — لكنه يكفي لمنع مستخدم واحد من استنزاف حصة TMDB بحلقة طلبات،
// وهو الخطر العملي هنا. للحدّ الصارم الموزّع يلزم مخزن خارجي (Upstash مثلاً).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** ينظّف المفاتيح المنتهية حتى لا تنمو الخريطة بلا سقف */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * يرجع true لو كان الطلب مسموحاً.
 * @param key    معرّف فريد (عادةً معرّف المستخدم + اسم المسار)
 * @param limit  أقصى عدد طلبات داخل النافذة
 * @param windowMs طول النافذة بالمللي ثانية
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** ثوانٍ متبقية حتى تُفتح النافذة — لترويسة Retry-After */
export function retryAfter(key: string): number {
  const b = buckets.get(key);
  if (!b) return 1;
  return Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000));
}
