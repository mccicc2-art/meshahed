import type { Dict } from "@/core/i18n";
import { formatDateShort } from "@/core/when";
import type { MsgEvent } from "../contracts";

/**
 * ====== صياغةُ الدردشة — الوقتُ في زاوية الفقاعة، فواصلُ الأيّام، ونصُّ النسخ (D-1401) ======
 *
 * 🔑 **بتوقيت الجهاز لا UTC**: «١:٠٣ ص» هي ساعةُ القارئ على حائطه، و«اليوم/أمس» يومُه هو — رسالةٌ بعد منتصف الليل
 * في الرياض «اليوم» ولو كانت «أمس» بتوقيت غرينتش. والتاريخُ الأقدم يُصاغ بـ`formatDateShort` نفسِها (أرقامٌ لاتينيّة
 * كبقيّة التطبيق، `num()`)، ونمرّر لها يومَ الجهاز مكتوباً فلا تنقله المنطقةُ الزمنيّة يوماً.
 */

/** «1:03 ص» · «1:03 AM» — الساعةُ ١٢ لا صفر، والدقيقتان رقمان */
export function clockOf(iso: string, t: Dict): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const h12 = h % 12 || 12;
  if (t.code === "en") return `${h12}:${mm} ${h < 12 ? "AM" : "PM"}`;
  return `${h12}:${mm} ${h < 12 ? "ص" : "م"}`;
}

/** يومُ الجهاز `YYYY-MM-DD` — مفتاحُ الفاصل */
export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  /* الظهرُ لا منتصفُ الليل: يومٌ يقصر أو يطول ساعةً (التوقيتُ الصيفيّ) لا يقلب التاريخ */
  return dayKeyOf(new Date(y, m - 1, d + days, 12).toISOString());
}

function weekdayOf(key: string, t: Dict): string {
  try {
    return new Intl.DateTimeFormat(t.code === "en" ? "en-GB" : "ar", { weekday: "long", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  } catch {
    return formatDateShort(key, t);
  }
}

/** فاصلُ اليوم كالواتس: «اليوم» · «أمس» · اسمُ اليوم خلال الأسبوع · ثمّ التاريخ */
export function dayLabelOf(key: string, t: Dict, now: Date = new Date()): string {
  const today = dayKeyOf(now.toISOString());
  if (key === today) return t.diaryToday;
  if (key === shiftDay(today, -1)) return t.diaryYesterday;
  for (let i = 2; i <= 6; i++) if (key === shiftDay(today, -i)) return weekdayOf(key, t);
  return formatDateShort(key, t);
}

/**
 * 🆕 D-1410 — وقتُ المحادثة في قائمة الرسائل كالواتس (أحمد ١٥ أكتوبر: «خل يطلع الوقت … أمس … تاريخ»): اليومَ الساعة،
 * وأمسِ «أمس»، وما قبله التاريخ كما كان — بلا أسماء أيّام (القائمةُ تُقرأ بلمحة).
 */
export function listStampOf(iso: string, t: Dict, now: Date = new Date()): string {
  const key = dayKeyOf(iso);
  if (!key) return "";
  const today = dayKeyOf(now.toISOString());
  if (key === today) return clockOf(iso, t);
  if (key === shiftDay(today, -1)) return t.diaryYesterday;
  return formatDateShort(key, t);
}

/** سطرُ عارض الصورة وورقةِ الرسالة: «الخميس ١٥ أكتوبر · 1:02 ص» — أو «اليوم · 1:02 ص» */
export function stampOf(iso: string, t: Dict, now: Date = new Date()): string {
  return `${dayLabelOf(dayKeyOf(iso), t, now)} · ${clockOf(iso, t)}`;
}

/** نصُّ الرسالة القابلُ للنسخ — الملاحظةُ تحت البطاقة، والتعليقُ تحت الصورة؛ GIF وحدَه لا نصَّ له */
export function copyableOf(e: MsgEvent): string {
  if (e.kind === "reply") return e.body.trim();
  return (e.note ?? "").trim();
}

/**
 * نسخُ المحدَّد كالواتس: رسالةٌ واحدةٌ نصُّها وحدَه، وأكثرُ ⇐ كلُّ رسالةٍ بسطرها مسبوقةً بوقتها واسمِ صاحبها،
 * **بترتيب المحادثة** لا بترتيب اللمس — فالمنسوخُ يُقرأ كما قيل.
 */
export function copyTextOf(selected: MsgEvent[], nameOf: (mine: boolean, e: MsgEvent) => string, t: Dict): string {
  const rows = [...selected].filter((e) => copyableOf(e)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (rows.length === 1) return copyableOf(rows[0]);
  return rows.map((e) => `[${clockOf(e.created_at, t)}] ${nameOf(e.mine, e)}: ${copyableOf(e)}`).join("\n");
}
