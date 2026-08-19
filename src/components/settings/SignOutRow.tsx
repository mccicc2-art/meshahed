import { Icon } from "../Icon";

/**
 * صفُّ الخروج — **نفسُ صفِّ الإعداد بلونٍ أحمرَ هادئ** (D-462).
 *
 * **ولا زرَّ ثانٍ ولا فعلَ خادمٍ جديد**: الخروجُ يقع منذ اليوم الأوّل
 * بنموذجٍ يُرسل إلى `/auth/signout` — **وهو الذي يمسح الكوكي على الخادم**
 * — **فالذي تبدّل شكلُه لا طريقُه** (شرطُ «لا تكسر الوظائف القائمة»).
 *
 * **ونموذجٌ لا زرُّ عميل**: الخروجُ يجب أن يعمل **بلا جافاسكربت** —
 * **وهو آخرُ ما تريد أن يتعطّل** إن سقط سكربتُ الصفحة.
 *
 * **والذي يميّزه اللونُ وحدَه**: شكلٌ ثانٍ له يجعله يُقرأ صنفاً آخر،
 * **وهو صفُّ إعدادٍ كسائرها إلا أنه الوحيد الذي يخرجك.**
 */
export function SignOutRow({ label }: { label: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="w-full flex items-center gap-3 min-h-14 px-4 py-3 text-start transition hover:bg-surface-2 active:opacity-80"
      >
        <Icon name="close" size={20} className="shrink-0 text-[color:var(--error)]" />
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-tight truncate text-[color:var(--error)]">
          {label}
        </span>
        <Icon
          name="chevron-down"
          size={18}
          className="shrink-0 text-muted -rotate-90 rtl:rotate-90"
        />
      </button>
    </form>
  );
}
