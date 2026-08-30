"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHiddenRails } from "@/lib/actions";
import { railsOf, type RailTab } from "@/lib/railPrefs";
import { getDict, type Locale } from "@/lib/i18n";
import { openPlusGate } from "@/lib/plusGate";
import { Icon } from "./Icon";
import { tap } from "@/lib/haptics";

/**
 * ====== صفوفُ اكتشف — أيُّها يظهر (D-826) ======
 *
 * **حكمُ أحمد**: «يقدر يخفي أيَّ عنوانٍ من هذي العناوين، **وتكون في
 * فيو**» — **فمكانُه تبويبُ «عرض» تحت ترتيب التبويبات.**
 *
 * 🔑 **وقسمان في لوحٍ واحدٍ لا لوحان**: **«عرض» يجيب سؤالاً واحداً —
 * «ما الذي يبقى بعد أن تُغلق الورقة؟»** (نصُّ `LibraryToolsSheet`) —
 * **والتبويباتُ والصفوفُ جوابان له، لا سؤالان.**
 *
 * ⚠️ **ولا تُعاد وصفةُ `TabsPrefs`** رغم التشابه (القاعدة ٣): **تلك
 * تُرتِّب وتُخفي، وهذه تُخفي وحدَها** — **وصفوفُ اكتشف ترتيبُها معنًى
 * محسوبٌ في الصفحة** («الآنَ أوّلاً ثمّ الشعبيّ ثمّ المرتَّب بالجودة
 * ثمّ القادم» — تعليقُ `AnimeRails` بنصّه)، **وسهمان يَعِدان بترتيبٍ
 * لا يقع** (D-217/D-346). **فالمشتركُ بينهما مفتاحُ العين وحدَه، وهو
 * وصفةُ صفٍّ لا وصفةُ لوح.**
 *
 * 🔒 **وبلس** — **والحارسُ في `setHiddenRails`** (D-819/D-821).
 * ⚠️ **والإظهارُ الكامل غيرُ محروس**: **من انقطع اشتراكُه لا يُحبس في
 * صفحةٍ أطفأ نصفَها ولا يملك إعادتَه.**
 */
export function RailsPrefs({
  locale,
  tab,
  hidden,
  title,
}: {
  locale: Locale;
  /** تبويبُ اكتشف الحاليّ — **صفوفُه وحدَها تُعرض** */
  tab: RailTab;
  /** المخفيُّ الآن — يأتي من الخادم فلا يومض مفتاحٌ ثمّ يُصحَّح */
  hidden: string[];
  title?: string;
}) {
  const t = getDict(locale);
  const ar = locale !== "en";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<string[]>(hidden);

  const rails = railsOf(tab);

  function commit(next: string[]) {
    tap(8);
    /* **والرجوعُ يُلتقط قبل التفاؤل** (درسُ `TabsPrefs` بنصّه): **`local`
       داخل المغلَّف لقطةُ الرسم لا الحالةُ بعد `setLocal`.** */
    const prev = local;
    setLocal(next);
    start(async () => {
      const res = await setHiddenRails(next);
      if (res?.needsPlus) {
        setLocal(prev);
        openPlusGate();
        return;
      }
      router.refresh();
    });
  }

  function toggle(key: string) {
    commit(local.includes(key) ? local.filter((k) => k !== key) : [...local, key]);
  }

  return (
    <div>
      {title && <p className="px-5 pt-3 pb-2 text-12 font-bold text-muted">{title}</p>}
      {/* **وسطرٌ يقول نطاقَه** (D-063): **القائمةُ صفوفُ هذا التبويب
          وحدَه** — **ومن أطفأ في «أفلام» ثمّ فتح «أنمي» فوجد غيرَها
          يظنّها لم تُحفظ.** */}
      <p className="px-5 pb-2 text-12 text-muted leading-relaxed">
        {ar ? "صفوفُ هذا التبويب — والمطفأُ يغيب بعنوانه." : "This tab's rows — hidden ones go with their heading."}
      </p>
      <ul>
        {rails.map((r) => {
          const off = local.includes(r.key);
          const label = r.label(t, tab);
          return (
            <li key={r.key} className="pe-3">
              <button
                type="button"
                role="switch"
                aria-checked={!off}
                disabled={pending}
                onClick={() => toggle(r.key)}
                className="w-full flex items-center justify-between gap-3 min-h-11 ps-5 pe-2 py-2 text-start text-15 rounded-e-xl hover:bg-surface-2 disabled:opacity-45 transition"
              >
                <span className="min-w-0 flex items-center gap-3">
                  <Icon name={off ? "eye-off" : "eye"} size={18} />
                  <span className="truncate">{label}</span>
                </span>
                {/* **نفسُ مفتاح `TabsPrefs` بالبكسل** — **مفتاحان بشكلين
                    في لوحٍ واحدٍ يُقرآن فعلين** (القاعدة ٣). */}
                <span
                  aria-hidden
                  className={`shrink-0 h-5 w-9 rounded-full transition relative ${
                    off ? "bg-border" : "bg-accent"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--background)] transition-all ${
                      off ? "start-0.5" : "start-[18px]"
                    }`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
