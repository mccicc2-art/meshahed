/**
 * ====== 🆕 A-05 — نطاقُ رمز الودجت (هجرة ٢٣٩، بناء 1.14.0) ======
 *
 * 🔑 **رمزان لا رمزٌ واحد**: `widget` يعلّم الحلقات ويقيّم ويضيف من الودجت، و`dm` يردّ في الرسائل ويختمها من الإشعار. رمزٌ يُقبل
 * على مساراته وحدَها — فمن وصل إلى رمز الودجت (في مجلّد الودجت على كلِّ جهاز) لا يكتب لأصدقاء صاحبه.
 *
 * ⚖️ **انتقالٌ مؤرَّخٌ لا مفتوح** (خطّةُ الأمن C1 البند ٤): نسخُ 1.13.x ترسل رمزَ الودجت إلى مسارَي الرسائل، فيُقبل هناك حتى
 * `WIDGET_ON_DM_UNTIL` ثمّ يُرفض. **والعكسُ ممنوعٌ من أوّل يوم**: رمزُ `dm` لا يعلّم حلقة — لا نسخةَ قديمةً تحتاجه.
 * خالصةٌ بلا قاعدة (`widgetScope.test.ts`)؛ المستدعي في `src/lib/widgetToken.ts`.
 */
export type WidgetScope = "widget" | "dm";

/** آخرُ يومٍ يُقبل فيه رمزُ `widget` على مسارَي الرسائل — بعده ردُّ الإشعار يحتاج رمزَ `dm` (بناء 1.14.0 فما بعده) */
export const WIDGET_ON_DM_UNTIL = "2027-01-15T00:00:00Z";

/** ما يُقرأ من عمود `scope` — صفٌّ قبل الهجرة (لا عمود) أو قيمةٌ غريبة ⇒ `widget`، وهو ما كانت عليه الرموزُ كلُّها */
export function scopeOf(v: unknown): WidgetScope {
  return v === "dm" ? "dm" : "widget";
}

export type ScopeVerdict = "ok" | "legacy" | "refused";

/** هل يُقبل رمزٌ بنطاق `has` على مسارٍ يحتاج `need`؟ `legacy` = يُقبل في فترة الانتقال ويُسجَّل سطرُه */
export function scopeVerdict(has: WidgetScope, need: WidgetScope, nowMs = Date.now()): ScopeVerdict {
  if (has === need) return "ok";
  if (need === "dm" && has === "widget" && nowMs < Date.parse(WIDGET_ON_DM_UNTIL)) return "legacy";
  return "refused";
}
