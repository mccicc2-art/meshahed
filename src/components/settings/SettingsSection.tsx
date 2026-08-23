import type { ReactNode } from "react";
import { settingsCard } from "./SettingsGroup";

/**
 * قسمُ إعدادٍ **بلا بطاقة** — **أختُ `SettingsGroup` حين يكون المحتوى
 * بطاقةً بنفسه** (D-555، مواصفةُ أحمد: «لا إطارات داخل إطارات»).
 *
 * **والعلّةُ التي وُلد منها:** كان في «المظهر» و«المحتوى» أربعةُ ألواحٍ
 * مكتوبةٍ باليد على هذه الصورة:
 * `bg-surface border border-border rounded-2xl p-5` **وفي داخلها بطاقةُ
 * معاينةٍ أو مسارُ رقائقَ له سطحُه وحدُّه** — **فحدّان متداخلان وانحناءان
 * متداخلان في كلِّ إعداد.** **وهو الذي يجعل الصفحةَ تُقرأ «مستديرةً
 * أكثر من اللازم» لا رقمُ الانحناء** — فالرقمُ ١٤ منذ D-454.
 *
 * **فالقسمُ الآن عنوانٌ ونصٌّ ومحتوًى**، والبطاقةُ — إن لزمت — **واحدةٌ
 * في الداخل لا اثنتان.**
 *
 * ⚠️ **والتلميحُ تحت المحتوى لا فوقه**: القارئُ جاء ليضبط شيئاً،
 * **وفقرةٌ قبل الأداة تؤخّر الجواب** — وهي شكوى أحمد بنصّها («نصوص
 * شرحية كثيرة»). **وما تحتها يُقرأ بعد أن يُفهم الخيار، أو لا يُقرأ
 * فلا يضرّ.**
 *
 * ================= 🆕 و`boxed`: العنوانُ داخل البطاقة (D-557) =========
 *
 * **تصميمُ أحمد لصفحة «تفضيلات المحتوى» يضع العنوانَ والشرحَ داخل
 * البطاقة** («Your taste» · «Languages» · «Title names» · «Watch
 * region»)، **وتحتهما صفوفٌ أو خيارات.**
 *
 * ⚠️ **وليس نقضاً لقاعدة «العنوان خارج البطاقة»** (`SettingsGroup`):
 * **القاعدةُ وُلدت لقائمةِ صفوفٍ كلُّها تُضغط** — «عنوانٌ داخلها يصير
 * صفّاً أوّلَ لا يُضغط بين صفوفٍ تُضغط كلُّها». **وهذه ليست قائمةَ
 * صفوف** بل **كتلةٌ لها موضوعٌ واحدٌ وداخلها أشكالٌ مختلفة**: صفٌّ
 * برقائق، ثمّ صفٌّ بنصّ، ثمّ مجموعةُ راديو، ثمّ معاينة. **وعنوانٌ يطفو
 * فوق كتلةٍ كهذه لا يقول أين تنتهي.**
 *
 * **والفرقُ عمليٌّ لا لفظيّ**: `SettingsGroup` تُستعمل للفهرس
 * و«الحساب» و«عن Loopz»، **و`boxed` لصفحةٍ واحدةٍ رسمها أحمد** —
 * **ولا ثالثَ بينهما.**
 */
export function SettingsSection({
  label,
  hint,
  action,
  boxed = false,
  children,
  className = "",
}: {
  /** عنوانُ القسم — يغيب فلا يُحجَز له مكان (D-044) */
  label?: string;
  /** سطرٌ واحدٌ يقول ما يترتّب على الخيار — لا شرحُ ما هو ظاهرٌ أصلاً */
  hint?: string;
  /** فعلُ الطرف الآخر من العنوان — «إدارة» · «استعادة» */
  action?: ReactNode;
  /** العنوانُ والشرحُ داخل البطاقة، والمحتوى تحتهما — تصميمُ D-557 */
  boxed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (boxed) {
    return (
      <section className={`${settingsCard} p-4 ${className}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {label && <h2 className="text-20 font-bold truncate">{label}</h2>}
            {hint && (
              <p className="text-14 text-muted leading-relaxed mt-1">{hint}</p>
            )}
          </div>
          {action}
        </div>
        <div className={label || hint ? "mt-3.5" : ""}>{children}</div>
      </section>
    );
  }

  return (
    <section className={className}>
      {(label || action) && (
        <div className="flex items-center gap-2 px-1 mb-2">
          <h2 className="min-w-0 flex-1 text-12 font-semibold uppercase tracking-wide text-muted truncate">
            {label}
          </h2>
          {action}
        </div>
      )}
      {children}
      {hint && (
        <p className="px-1 mt-2 text-12 text-muted leading-relaxed">{hint}</p>
      )}
    </section>
  );
}
