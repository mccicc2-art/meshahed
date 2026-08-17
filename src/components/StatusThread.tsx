/**
 * **خيطُ الحالة تحت الملصق — وصفةٌ واحدةٌ لكلِّ سطحٍ يرسمه** (D-322).
 *
 * ================= لماذا استُخرج =================
 *
 * **لأنه نُسخ مرّةً فعاد عطلُه من بابٍ آخر، وهو مسجَّلٌ باسمه في D-289:**
 * الخيطُ عاش في `PosterCard` و**نسخةٌ ثانيةٌ منه في `PosterHold`**، فلمّا
 * صُحّح لونُ «عندك» إلى `--info` في الأصل (بلاغُ أحمد: «هذا خلّه سماوي،
 * الرصاصي ما هو واضح») **بقيت النسخةُ رماديّةً سبعةَ أيام** — وقارئُها
 * الوحيدُ هو الضغطُ المطوَّل، **فبدا الفعلُ كأنه لم يقع.**
 *
 * **فوصفةٌ تُنسخ ثم يُصلَح أصلُها وحدَه هي كيف يعود العطلُ** (D-145)،
 * **والوقايةُ استخراجٌ لا نسخ** — ودفعةٌ تضيف حالتين جديدتين (الأصفرَ
 * الجاري والأحمرَ الموقوف) إلى النسختين معاً هي أرخصُ لحظةٍ للاستخراج
 * (D-214).
 *
 * ⚠️ **وهو مكوّنٌ نقيٌّ بلا حالة** — لا `"use client"` ولا دالّةَ تعبر
 * حدَّ الخادم/العميل (D-235): **يقرؤه `PosterCard` من الخادم بحقائق
 * القاعدة، ويقرؤه `PosterHold` من العميل بحالته التفاؤليّة**، ولا يعرف
 * أيُّهما ناداه.
 */
export interface StatusThreadProps {
  /** في مكتبتك ولم يبدأ — سماويّ */
  saved?: boolean;
  /** انتهيتَ منه — أخضر */
  watched?: boolean;
  /** ٠..١٠٠ — أصفرُ بمقدارها */
  progress?: number;
  /** بطاقةٌ حمراء — أحمرُ كاملاً */
  dropped?: boolean;
  /**
   * **`inset`: يُقصّ بنفسه داخل حدِّ البطاقة** (D-238) — يحتاجه من يرسم
   * الخيطَ **فوق** بطاقةٍ مكتملةٍ لا داخلها (`PosterHold`)، **ولا
   * يحتاجه من يرسمه داخل صندوقٍ مقصوصٍ أصلاً** (`PosterCard`).
   * **وما يجب أن يتبع شكلَ صندوقٍ يُقصّ به لا يُعاد بناءُ شكلِه من
   * خارجه.**
   */
  inset?: boolean;
}

/** هل ثمّة حالةٌ تُقال أصلاً؟ — وما لم يبدأ ولا حُفظ لا خيطَ له إطلاقاً */
export function hasStatus({ saved, watched, progress, dropped }: StatusThreadProps): boolean {
  return !!dropped || !!watched || !!saved || (progress ?? 0) > 0;
}

export function StatusThread({
  saved = false,
  watched = false,
  progress = 0,
  dropped = false,
  inset = false,
}: StatusThreadProps) {
  if (!hasStatus({ saved, watched, progress, dropped })) return null;

  const pct = Math.max(0, Math.min(100, progress));
  /* **الأولوية: موقوفٌ ثم منتهٍ ثم جارٍ ثم محفوظ** — **وأخصُّ الحالات
     يغلب أعمَّها**، فعملٌ منتهٍ محفوظٌ يُقرأ منتهياً لا محفوظاً. */
  const full = dropped || watched || (saved && pct <= 0);
  const color = dropped
    ? "var(--error)"
    : watched || pct >= 100
      ? "var(--success)"
      : pct > 0
        ? "var(--accent)"
        : /* **«عندك» سماويّ لا رماديّ** (بلاغُ أحمد): الرماديُّ كان حدَّ
             البطاقة نفسَه فلا يُرى — **وخيطٌ لا يُرى ليس حالةً هادئة، هو
             خيطٌ غائب.** و`--info` رمزٌ قائمٌ في اللوحة **دلاليٌّ لا
             يتبدّل مع الثيم**، فيُقرأ في `daylight` كما في الليل. */
          "var(--info)";

  const bar = (
    <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
      <span
        className="block h-full transition-colors"
        style={{ width: full ? "100%" : `${pct}%`, background: color }}
      />
    </span>
  );

  return inset ? (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-px rounded-poster overflow-hidden"
    >
      {bar}
    </span>
  ) : (
    bar
  );
}
