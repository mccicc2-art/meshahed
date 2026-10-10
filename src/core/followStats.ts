/**
 * ====== متى يُعاد قراءةُ إحصاء المتابعة المخزَّن؟ (D-1271) ======
 *
 * المكتبةُ والرئيسيّةُ تحكمان «انتهى / باقي حلقات» من رقمٍ مخزَّنٍ على صفِّ المتابعة (`aired_episodes`) لا من
 * TMDB — فالمكتبةُ صفرُ رحلاتٍ خارجيّة. **وكان يُكتب مرّةً ثمّ لا يُجدَّد إلّا بفتح صفحة العمل في الويب**: صفحةُ
 * العمل الأصليّةُ في التطبيق لا تكتبه، فمن خلّص مسلسلاً ثمّ نزلت له حلقةٌ بقي عنده «انتهى» في المكتبة والرئيسيّة
 * وصفحةُ العمل نفسُها تعرض الحلقة (المقيس ٤ أكتوبر ٢٠٢٦: ٢٩ صفّاً من ٣٩٣ فات موعدُها المخزَّن، عند ١٨ مستخدماً،
 * أقدمُها ٧ أغسطس).
 *
 * صنفان، ولكلٍّ ثمنُه:
 *  ١) **فات موعدُ حلقته المخزَّن ولم يُقرأ منذئذ** — حلقةٌ نزلت والصفُّ لا يعلم. هذا ما يراه المستخدم، فيُقرأ
 *     **قبل** بناء الرئيسيّة: الردُّ نفسُه يخرج صحيحاً لا الذي بعده.
 *  ٢) **بلا موعدٍ قادم وقد مضى عليه أسبوع** — موسمٌ جديدٌ أُعلن بعد آخر قراءة. نادرٌ ولا يستعجل، فيُقرأ في موجة
 *     الرئيسيّة نفسِها مع صفوف التهيئة ويظهر أثرُه في الفتحة التالية — لا رحلةَ تسبق الرئيسيّةَ لأجله.
 *
 * نقيّةٌ بلا استيراد: القرارُ هنا، والجلبُ والكتابةُ عند من يناديها.
 */

export type FollowStatsRow = {
  tmdb_id: number;
  media_type: string;
  dropped?: boolean | null;
  aired_episodes?: number | null;
  next_air_date?: string | null;
  stats_updated_at?: string | null;
};

/** سقفُ ما يُقرأ في الفتحة الواحدة — سقفُ صفوف التهيئة نفسُه؛ المكتبةُ الكبيرة تلحق على دفعات */
export const FRESHEN_CAP = 12;
/** عمرُ القراءة الذي بعده يُعاد صفٌّ بلا موعدٍ قادم */
export const STALE_DAYS = 7;

const live = (r: FollowStatsRow) => r.media_type === "tv" && !r.dropped;

/**
 * الصنفُ الأوّل: موعدُ الحلقة القادمة المخزَّنُ حلّ (اليومُ منه — D-1253: حلقةُ اليوم معروضة) وآخرُ قراءةٍ قبله.
 * ⚠️ **قراءةٌ في يوم العرض نفسِه تكفي**: `airedEpisodeCount` عدّت الحلقةَ يومَها، وTMDB يُبقيها «القادمة» طوال
 * يومها — فلولا هذا الشرطُ لأُعيدت القراءةُ في كلِّ فتحةٍ ذلك اليوم. الأحدثُ موعداً أوّلاً.
 */
export function airedSinceStored(rows: readonly FollowStatsRow[], today: string, cap = FRESHEN_CAP): number[] {
  return rows
    .filter((r) => {
      if (!live(r) || !r.next_air_date || r.next_air_date > today) return false;
      const read = r.stats_updated_at ? r.stats_updated_at.slice(0, 10) : "";
      return read < r.next_air_date;
    })
    .sort((a, b) => (b.next_air_date ?? "").localeCompare(a.next_air_date ?? ""))
    .slice(0, cap)
    .map((r) => r.tmdb_id);
}

/**
 * 🆕 D-1342 — الصنفُ الثالث: **بلا رقمٍ مخزَّن وقد شوهدت منه حلقات** — يُقرأ **قبل** البناء كالأوّل.
 *
 * العطل (تسجيلُ أحمد ١٠ أكتوبر، أوّلُ تجربةٍ للترحيب الجديد): اختار «شاهدته كاملاً» لـGame of Thrones فكُتبت
 * حلقاتُه الـ٧٣، وظهر في الرئيسيّة تحت «أكمل المشاهدة» بنسبة ٠٪. صفُّ المتابعة الجديد يولد بلا `aired_episodes`،
 * وصفوفُ التهيئة تُقرأ في موجة الرئيسيّة **ويُكتب رقمُها للفتحة التالية** — فالرسمةُ الأولى حسبت «٧٣ مشاهَدة من ٠
 * معروضة»، و«٠ معروضة» تُقرأ «لم ينتهِ». والقاعدةُ صحيحةٌ بعد ثانيتين (٧٣ من ٧٣) والشاشةُ أمامه تقول غيرَها.
 *
 * ⚖️ **«وقد شوهدت منه حلقات» شرطٌ لا زينة**: صفٌّ بلا رقمٍ وبلا مشاهدة يُرسم «للمشاهدة» صحيحاً بلا رقمه —
 * فلا تُدفع له رحلةٌ تسبق الرئيسيّة؛ يبقى صفَّ تهيئةٍ في الموجة كما كان. الخطأُ لا يقع إلّا حين يُقارَن مشاهَدٌ بمعروض.
 */
export function watchedUncounted(
  rows: readonly FollowStatsRow[],
  watchedIds: ReadonlySet<number>,
  cap = FRESHEN_CAP,
): number[] {
  return rows
    .filter((r) => live(r) && r.aired_episodes == null && watchedIds.has(r.tmdb_id))
    .slice(0, cap)
    .map((r) => r.tmdb_id);
}

/**
 * الصنفُ الثاني: بلا موعدٍ قادم، وله رقمٌ مخزَّن (ما لا رقمَ له صفُّ تهيئةٍ يُقرأ أصلاً)، وآخرُ قراءته أقدمُ من
 * `STALE_DAYS` أو مجهولة. الأقدمُ قراءةً أوّلاً.
 */
export function staleStored(rows: readonly FollowStatsRow[], nowMs: number, cap = FRESHEN_CAP): number[] {
  const limit = nowMs - STALE_DAYS * 86_400_000;
  const at = (r: FollowStatsRow) => (r.stats_updated_at ? Date.parse(r.stats_updated_at) : 0) || 0;
  return rows
    .filter((r) => live(r) && !r.next_air_date && r.aired_episodes != null && at(r) < limit)
    .sort((a, b) => at(a) - at(b))
    .slice(0, cap)
    .map((r) => r.tmdb_id);
}
