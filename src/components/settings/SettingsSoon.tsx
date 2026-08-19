import { Icon, type IconName } from "../Icon";

/**
 * لوحُ «لم يُبنَ بعد» — **الصدقُ في مكان الميزة الغائبة** (D-462).
 *
 * **وكان مكتوباً داخل `SettingsShell`** لقسم الفوترة وحده؛ **وصار
 * مكوّناً لأن له قارئاً ثانياً** (D-002: يُستخرج عند القارئ الثاني، لا
 * قبله) — الفوترةُ والإشعارات.
 *
 * ⚠️ **والحدُّ متقطّعٌ عمداً** (`border-dashed`): **بطاقةٌ بحدٍّ صلبٍ
 * تُقرأ محتوًى جاهزاً**، والمتقطّعُ يقول «هنا فراغٌ معروف» قبل أن يُقرأ
 * النصّ — **والقارئُ يفهم الحالةَ من بعيدٍ بلا كلمة.**
 */
export function SettingsSoon({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: IconName;
}) {
  return (
    <section className="bg-surface border border-dashed border-border rounded-2xl p-8 text-center">
      <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-surface-2 text-muted mb-3">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-[15px] font-bold">{title}</h2>
      <p className="text-[14px] text-muted leading-relaxed mt-1.5 max-w-sm mx-auto">{body}</p>
    </section>
  );
}
