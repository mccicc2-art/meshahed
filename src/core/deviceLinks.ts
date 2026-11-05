/**
 * ====== 🆕 مدارُ الأجهزة — كم خانةً للعضو، وأيُّ روابطه داخلها (هجرة ٢٣٧، أحمد ٥ نوفمبر) ======
 *
 * 🔑 **الربطُ خاناتٌ تُعدّ لا ميزةٌ مقفلة**: المجانيُّ جهازٌ واحدٌ من «من أجهزتك»، وبلس خمسة (والذهبيُّ بلا حدٍّ مع المرحلة ١).
 * والحسبةُ هنا وحدها (D-145) — يقرؤها بابُ الإصدار، وبابُ الاستقبال (`linkOwner`)، وصفحةُ «الربط»، و«اختر ما يبقى».
 *
 * - **الخانةُ تُعدّ من لحظة الإصدار** (أو ربطِ Kodi) لا من أوّل حدث.
 * - **رابطٌ لكلِّ نوع**: Plex وJellyfin وEmby كلٌّ برابطه، وKodi وStremio كذلك — فخمسةُ أجهزةٍ أقصى ما يُربط اليوم.
 * - **الرابطُ القديمُ بلا نوع** (`server = null` — قبل ٢٣٧، أو من تطبيق 1.13.x) لا يُقسم: يُعدّ خانةً لكلِّ نوعٍ أرسل منه، وخانةً
 *   واحدةً قبل أوّل إرسال.
 * - **النزولُ لا يحذف**: ما زاد على الخانات يُوقف (`stopped_at`)، والباقي أحدثُها استعمالاً — والموقوفُ يعود حين تتّسع الخانات
 *   (اشتراكٌ جديد) أو يختاره العضو في «اختر ما يبقى».
 * ⚠️ **هذا الملفّ لا يقرأ القاعدة** — يأخذ الصفوفَ ويعيد الحكم، فيُختبر بلا خادم (`deviceLinks.test.ts`).
 */

export type DeviceKind = "stremio" | "plex" | "jellyfin" | "emby" | "kodi";
export type HomeKind = "plex" | "jellyfin" | "emby";

/** ترتيبُ «من أجهزتك» ثابت (أحمد: «ترتيبٌ ثابتٌ للمنصّات») */
export const DEVICE_KINDS: readonly DeviceKind[] = ["stremio", "plex", "jellyfin", "emby", "kodi"];
export const HOME_KINDS: readonly HomeKind[] = ["plex", "jellyfin", "emby"];

export function isDeviceKind(v: unknown): v is DeviceKind {
  return typeof v === "string" && (DEVICE_KINDS as readonly string[]).includes(v);
}
export function isHomeKind(v: unknown): v is HomeKind {
  return typeof v === "string" && (HOME_KINDS as readonly string[]).includes(v);
}

/** الطبقةُ كما يراها العدّ — الذهبيُّ يُقرأ من حقله مع المرحلة ١، وإلى ذلك الحين لا يصل هنا */
export type LinkTier = "free" | "plus" | "gold";

/** خاناتُ الطبقة: ١ · ٥ · بلا حدّ */
export function slotLimit(tier: LinkTier): number {
  return tier === "gold" ? Infinity : tier === "plus" ? 5 : 1;
}

export type LinkTableName = "stremio_links" | "home_server_links" | "kodi_links";

/** صفُّ رابطٍ كما يقرؤه الخادم من الجداول الثلاثة */
export interface LinkRow {
  table: LinkTableName;
  token_hash: string;
  /** `home_server_links` وحده: النوعُ المربوط، أو `null` للرابط القديم */
  server: HomeKind | null;
  /** للرابط القديم وحده: الأنواعُ التي أرسلت منه */
  kinds: HomeKind[];
  created_at: string;
  last_used_at: string | null;
  stopped_at: string | null;
}

const IDLE_MS = 90 * 86_400_000;

/** رابطٌ نام ٩٠ يوماً ميّت (A-05) — لا يُعدّ ولا يُستقبل */
export function isAlive(r: LinkRow, now = Date.now()): boolean {
  const t = Date.parse(r.last_used_at ?? r.created_at);
  return Number.isNaN(t) ? false : now - t <= IDLE_MS;
}

/** الأجهزةُ التي يمثّلها الصفّ — والرابطُ القديمُ قبل أوّل إرسالٍ لا جهازَ معروفاً له */
export function kindsOf(r: LinkRow): DeviceKind[] {
  if (r.table === "stremio_links") return ["stremio"];
  if (r.table === "kodi_links") return ["kodi"];
  return r.server ? [r.server] : [...r.kinds];
}

/** كم خانةً يأخذ الصفّ — القديمُ خانةٌ لكلِّ نوعٍ رآه، وخانةٌ قبل أوّل إرسال */
export function slotsOf(r: LinkRow): number {
  return Math.max(1, kindsOf(r).length);
}

const recency = (r: LinkRow) => Date.parse(r.last_used_at ?? r.created_at) || 0;

/**
 * من يبقى ومن يُوقف تحت حدٍّ معيّن — **حكمٌ ثابت**: الشغّالُ قبل الموقوف، ثمّ الأحدثُ استعمالاً؛ ويُملأ حتى الحدّ.
 * فالنزولُ يُبقي أحدثَها، و«اختر ما يبقى» (يوقف غيرَ المختار) لا ينقلب في الطلب التالي، والموقوفُ يعود حين تتّسع الخانات.
 * ⚖️ صفٌّ لا يتّسع له الباقي كلُّه (قديمٌ بنوعين وبقيت خانة) يُوقف كلُّه — لا يُقسم.
 */
export function partition(rows: LinkRow[], limit: number, now = Date.now()): { keep: LinkRow[]; stop: LinkRow[] } {
  const alive = rows.filter((r) => isAlive(r, now));
  const ordered = [...alive].sort((a, b) => Number(!!a.stopped_at) - Number(!!b.stopped_at) || recency(b) - recency(a));
  const keep: LinkRow[] = [];
  const stop: LinkRow[] = [];
  let used = 0;
  for (const r of ordered) {
    const n = slotsOf(r);
    if (used + n <= limit) {
      keep.push(r);
      used += n;
    } else stop.push(r);
  }
  return { keep, stop };
}

/** الخاناتُ المستعملةُ الآن (الشغّالُ الحيّ وحده) */
export function usedSlots(rows: LinkRow[], now = Date.now()): number {
  return rows.filter((r) => isAlive(r, now) && !r.stopped_at).reduce((n, r) => n + slotsOf(r), 0);
}

/**
 * هل يُصدر رابطٌ لهذا الجهاز؟ — **الاستبدالُ مسموحٌ دائماً** (رابطٌ جديدٌ لجهازٍ مربوطٍ يحلّ محلَّ القديم ولا يأخذ خانة)،
 * والجديدُ يحتاج خانةً فارغة. ورابطٌ قديمٌ بلا نوعٍ يُعدّ «هذا الجهاز» إن كان رآه، أو لم يرَ شيئاً بعد (هو المقصود غالباً).
 */
export function canIssue(rows: LinkRow[], kind: DeviceKind, limit: number, now = Date.now()): boolean {
  const live = rows.filter((r) => isAlive(r, now) && !r.stopped_at);
  const replaces = live.filter((r) => replacedBy(r, kind));
  const freed = replaces.reduce((n, r) => n + (r.server || r.table !== "home_server_links" || r.kinds.length <= 1 ? slotsOf(r) : 1), 0);
  return usedSlots(rows, now) - freed + 1 <= limit;
}

/** هل يحلّ رابطُ هذا الجهاز محلَّ الصفّ (كلِّه أو نوعٍ منه)؟ */
export function replacedBy(r: LinkRow, kind: DeviceKind): boolean {
  if (r.table === "stremio_links") return kind === "stremio";
  if (r.table === "kodi_links") return kind === "kodi";
  if (r.server) return r.server === kind;
  return isHomeKind(kind) && (r.kinds.length === 0 || r.kinds.includes(kind));
}

/**
 * حدثٌ وصل برابطٍ قديمٍ بلا نوع من سيرفر `kind`: يُقبل إن رآه قبلُ، أو كان أوّلَ ما يرسل (خانتُه محسوبة)، أو بقيت خانة —
 * و`bind` يقول هل يُضاف النوعُ إلى الصفّ. وحدثٌ من نوعٍ له رابطُه الخاصّ يُردّ: الرابطُ الجديدُ هو المعتمد.
 */
export function acceptOnUnbound(rows: LinkRow[], row: LinkRow, kind: HomeKind, limit: number, now = Date.now()): { ok: boolean; bind: boolean } {
  if (row.stopped_at) return { ok: false, bind: false };
  if (row.kinds.includes(kind)) return { ok: true, bind: false };
  const dedicated = rows.some((r) => r.table === "home_server_links" && r.server === kind && isAlive(r, now));
  if (dedicated) return { ok: false, bind: false };
  if (row.kinds.length === 0) return { ok: true, bind: true };
  return usedSlots(rows, now) + 1 <= limit ? { ok: true, bind: true } : { ok: false, bind: false };
}
