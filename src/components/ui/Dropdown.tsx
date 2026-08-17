"use client";

import { useEffect, useRef } from "react";
import { Icon, type IconName } from "../Icon";

/**
 * **قائمةٌ منسدلة مربوطةٌ بمقبضها** (D-226، طلبُ أحمد: «مثل تويتر — قائمةٌ
 * منسدلةٌ ناعمة فيها أنيميشن سريع»).
 *
 * **وهي استخراجٌ لا اختراع:** `LangFlagMenu` تكتب هذا الشكلَ بيدها منذ
 * D-162 — نفسُ البطاقة المرتفعة، ونفسُ ماسك النقر المبوَّب إلى `body`،
 * ونفسُ حجّة `z-index`. **والنسخةُ الثانية كانت ستصير عائلةً ثانية**، فما
 * كان مكتوباً هناك نُقل هنا، **ونسخةُ الأصل حُذفت في الدفعة نفسها**
 * (D-159/D-166: العلاج عند المصدر، وتُحذف نسخُه معه).
 *
 * ================= ثلاثةُ قراراتٍ منقولةٌ بحجّتها =================
 *
 * **🔴 ١ · ~~ماسكُ النقر عنصرٌ في `body`~~ — سقط كلَّه في D-293.**
 *
 * **بلاغُ أحمد: «ترا هذا للأن ماهو شغال» على قائمة الضغط المطوَّل.**
 * **والقياسُ من الصفحة الحيّة لا من القراءة** (D-152):
 * `document.elementFromPoint` **على مركز كلِّ صفٍّ من الثلاثة عاد بـ**
 * `button.fixed.inset-0.z-20` — **ماسكُنا نحن.** **فكلُّ ضغطةٍ كانت تقع
 * عليه فتُغلق القائمةَ ولا تفعل شيئاً**، **والفعلُ سليمٌ لم يُنادَ قطّ.**
 *
 * **والسببُ البنيويّ:** الماسكُ في `body` أي في سياق التكديس الجذريّ،
 * **والقائمةُ `z-50` لكنّها محبوسةٌ داخل سياقِ تكديسٍ أقربَ** أنشأه
 * `will-change: transform` على مسار `TabPager` (D-276/D-279).
 * **وسياقٌ داخليٌّ `z-index: auto` يُرسم كلُّ ما فيه في مرتبة أبيه** —
 * **فـ`z-50` صارت تعني «الأعلى داخل المسار» لا «الأعلى في الصفحة»،
 * و`z-20` في الجذر تعلوها.**
 *
 * **⚠️ وهذا هو العطلُ نفسُه الذي عولج مرّةً برقم** (`z-40` → `z-20`)
 * **وعاد يومَ وُلد سياقُ تكديسٍ جديد لم يكن موجوداً حين كُتب الرقم.**
 * **وعلاجٌ برقمٍ يصمد حتى يتغيّر جارُه ليس علاجاً** (D-148: العلاج عند
 * المصدر). **فسقط العنصرُ كلُّه**، ومعه `catcherZ` **لأن معناه سقط**
 * (D-214).
 *
 * **والبديلُ مستمعٌ لا عنصر:** `pointerdown` على `document` في طور
 * **الالتقاط** — **ما وقع خارج اللوحة يُغلقها**. **ولا شيءَ يُرسم
 * فلا شيءَ يُحجب**، **وسياقاتُ التكديس تصير غيرَ ذات صلة أصلاً.**
 * **⚠️ وابتلاعُ النقرة محفوظٌ**: الطورُ الالتقاطيُّ يمنع الحدثَ عن
 * هدفه، **فضغطةٌ خارج القائمة تُغلقها ولا تفتح ما تحتها** — **وهو ما كان
 * الماسكُ يشتريه**، **وقد اشتُري بلا عنصر.**
 *
 * **٢ · `Escape` يُغلق، والتركيز يعود إلى المقبض.** قائمةٌ لا تُغلق
 * بالمفتاح مصيدةٌ لمن لا يستعمل فأرة (قاعدةُ الوصول الملزِمة).
 *
 * ⚠️ **وما ليست هي:** ليست بديلاً عن `Sheet`. **الورقةُ لقرارٍ يستحقّ أن
 * يوقف الصفحة** (بلاغ · حظر · اختيار صورة)، **والمنسدلةُ لخيارٍ سريعٍ
 * ملتصقٍ بمقبضه**. اثنتان لأن المعنيين اثنان، لا لأن الشكلين اثنان.
 */
export function Dropdown({
  open,
  onClose,
  labelledBy,
  align = "end",
  caret = false,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** معرّفُ العنصر الذي يسمّي القائمة — المقبضُ عادةً */
  labelledBy?: string;
  /** جهةُ المحاذاة تحت المقبض: النهاية افتراضاً (تنقلب في RTL من نفسها) */
  align?: "start" | "end";
  /**
   * **سنٌّ صغير يشير إلى المقبض** (D-233، بلاغُ أحمد: «هذي القائمة ما هي
   * واضحة إنها طالعة من الفلم»).
   *
   * **يُطلب حين يكون المقبضُ صورةً لا رمزاً**: قائمةُ النقاط ملتصقةٌ
   * برمزٍ صغيرٍ فوقها مباشرةً فالعلاقةُ ظاهرة، **أمّا الملصقُ فعرضُه ٩٢px
   * والقائمةُ ٢٠٨** — فتخرج مزاحةً وتبدو معلَّقةً في الهواء. **والسنُّ
   * يربطها بحافته**، ومعه إطارٌ يُضيء الملصقَ نفسَه (انظر `PosterHold`).
   */
  caret?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    /**
     * 🆕 **الإغلاقُ بالنقر خارجها — مستمعٌ لا ماسك** (D-293).
     *
     * **والطورُ التقاطيٌّ عمداً**: يصل الحدثُ قبل هدفه، **فما وقع خارج
     * اللوحة يُغلقها ولا يصل إلى ما تحتها** — **وهو ما كان الماسكُ
     * المرسومُ يشتريه، بلا عنصرٍ يُحجب به شيء.**
     *
     * ⚠️ **و`pointerdown` لا `click`**: الضغطةُ على شاشةٍ تُمرَّر قد لا
     * تُنتج `click` أصلاً، **وقائمةٌ لا تُغلق إلا بنقرةٍ كاملة تبقى
     * مفتوحةً تحت الإصبع.**
     *
     * ⚠️ **ولا تُبتلع نقرةُ ما داخلها**: الشرطُ `contains` وحدَه،
     * **والسنُّ خارج اللوحة فلا يُحسب داخلاً** — وهو رمزٌ لا يُضغط.
     */
    function onDown(e: PointerEvent) {
      const el = panel.current;
      if (!el || el.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {caret && (
        <span
          aria-hidden
          /* مربّعٌ مُدارٌ نصفُه تحت البطاقة — **حدٌّ على ضلعين فقط** حتى لا
             يُرسم خطٌّ عبر جسم القائمة */
          className={`absolute ${align === "end" ? "end-4" : "start-4"} top-full mt-0.5 z-50 w-3 h-3 rotate-45 rounded-[3px] border-s border-t border-border bg-[color:var(--elevated)] menu-pop`}
        />
      )}
      <div
        ref={panel}
        role="menu"
        aria-labelledby={labelledBy}
        /* `end-0`/`start-0` منطقيّتان فتنقلبان في RTL بلا شرط (D-216)،
           و`--menu-origin` يجعل الحركة تخرج من المقبض لا من الوسط */
        style={{ ["--menu-origin" as string]: align === "end" ? "100% 0" : "0 0" }}
        className={`absolute ${align === "end" ? "end-0" : "start-0"} top-full mt-1.5 z-50 min-w-52 rounded-2xl border border-border bg-[color:var(--elevated)]/95 backdrop-blur-xl shadow-2xl overflow-hidden py-1 menu-pop ${className}`}
      >
        {children}
      </div>
    </>
  );
}

/**
 * صفٌّ داخل المنسدلة — **وصفةٌ لا مكوّن** (D-145): بعضُ الصفوف `button`
 * وبعضُها `Link`، فالمشترك سلسلةُ الأصناف لا الوسم.
 */
export const dropdownItem =
  "w-full flex items-center gap-3 px-4 py-2.5 text-start text-[14px] text-foreground " +
  "hover:bg-surface-2 active:bg-surface-2 disabled:opacity-50 transition";

export const dropdownDivider = "my-1 h-px bg-[color:var(--divider)]";

/**
 * 🆕 **صفُّ فعلٍ في المنسدلة — مكوّنٌ عند قارئه الثاني** (D-002/D-376).
 *
 * **وُلد محليّاً في `PosterHold` باسم `HoldRow`** حين كانت المنسدلةُ
 * سطحَ ضغطٍ واحداً. **وجاء قارئُه الثاني** يومَ صارت شبكةُ المكتبة
 * تفتح المنسدلةَ نفسَها (D-376) — **ونسخُه كان سيعني صفَّين يفترقان في
 * الحشوة أو في لون الحالة النشطة بعد أوّل تعديل** (D-145: وصفةٌ تُنسخ
 * ثم يُصلَح أصلُها وحدَه يعود عطلُها من بابٍ آخر).
 *
 * **وبيتُه هنا لا هناك**: الصفُّ جزءٌ من عائلة المنسدلة، **ووصفةُ
 * `dropdownItem` تحته مباشرةً** — فمن قرأ الملفَّ رأى الاثنين معاً.
 *
 * ⚠️ **والحدثُ يُوقَف عن أبيه**: المنسدلةُ قد تُفتح داخل بطاقةٍ هي رابط،
 * **ومن ضغط صفَّاً في قائمةٍ لم يقصد أن يفتح ما تحتها** (D-155/D-339).
 */
export function DropdownRow({
  icon,
  label,
  active = false,
  disabled = false,
  tone,
  onClick,
}: {
  icon: IconName;
  label: string;
  /** الفعلُ قائمٌ الآن — فيلبس لون التمييز */
  active?: boolean;
  disabled?: boolean;
  /** لونُ الرمز حين يحمل حالةً بعينها (نجاحٌ أو خطر) — **والافتراضُ محايد** */
  tone?: "success" | "danger";
  onClick: () => void;
}) {
  const color =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "danger"
        ? "text-[color:var(--error)]"
        : active
          ? "text-accent"
          : "text-muted";
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={dropdownItem}
    >
      <Icon name={icon} size={18} className={`${color} shrink-0`} />
      <span className={active ? "text-accent" : undefined}>{label}</span>
    </button>
  );
}
