"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTabPrefs } from "@/lib/actions";
import { openPlusGate } from "@/lib/plusGate";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import {
  moveTab,
  toggleTab,
  visibleTabs,
  type TabPref,
  type TabSurface,
} from "@/lib/tabPrefs";
import { Icon } from "./Icon";

/**
 * قسمُ «تبويباتٌ يملكها صاحبها» — **الترتيب والإظهار**، مكوّنٌ واحد لأربع
 * أوراق (المجتمع · اكتشف · قوائم اكتشف · المكتبة).
 *
 * **ولماذا قسمٌ لا ورقة** (وهو انحرافٌ مقصود عن اسم المواصفة
 * `TabsPrefsSheet`): كلُّ صفحةٍ من الثلاث **لها ورقةُ أدواتٍ قائمة خلف
 * الرمز نفسه** منذ D-177. فورقةٌ خامسة تعني **باباً ثانياً خلف رمزٍ واحد**
 * أو **رمزاً ثانياً في صفٍّ يتنافس فيه أربعةُ تبويباتٍ عربية على ٣٦٠
 * بكسلاً** — وكلاهما نقضٌ لِما اشترى D-177 ثمنَه. المشترَك هو **المنطق**
 * (وهو ما تحذّر منه D-145)، والمنطقُ هنا في مكانٍ واحد.
 *
 * **والترتيب بسهمين لا بالسحب — وثلاثةُ أسبابٍ تُقاس:**
 *  ١) **بلا التباسٍ مع تمرير الورقة:** محرّك السحب موجودٌ أصلاً (D-043)،
 *     **لكنّه داخل ورقةٍ تُمرَّر**. على الجوال، إصبعٌ نازلٌ على صفٍّ يعني
 *     «مرِّر الورقة» أو «اسحب الصفّ»، ولا يعرف المتصفّح أيّهما إلا بعد
 *     لمسٍ مطوّل. **وأربعةُ عناصر لا تستحقّ هذا الالتباس.**
 *  ٢) **صريح:** ترى ماذا سيحدث قبل أن تضغط.
 *  ٣) **يعمل بلوحة المفاتيح وقارئ الشاشة بلا سطرٍ إضافيّ** (رقم ١٦).
 *
 * **والسهمُ يُعطَّل في طرفه** — منعُ الفعل قبل وقوعه، نفسُ قاعدة D-177 في
 * مفتاح آخر تبويب. **والمفتاح الأخير الظاهر يُعطَّل كذلك:** صفحةٌ بلا
 * تبويبٍ واحد صفحةٌ بلا باب.
 *
 * **والسهم يتخطّى المخفيّ ولا يعبره** (`moveTab`): الترتيب الذي تراه هو
 * ترتيبُ الظاهر، فسهمٌ يبدو أنه لم يفعل شيئاً — لأنه تبادل مع تبويبٍ
 * مخفيّ — عطلٌ في عين من ضغطه.
 */
export function TabsPrefs({
  locale,
  surface,
  prefs,
  labels,
  title,
}: {
  locale: Locale;
  surface: TabSurface;
  /** الحالة الحالية — تأتي من الخادم فلا يومض ترتيبٌ ثم يُصحَّح */
  prefs: TabPref[];
  /** أسماء التبويبات كما تُعرض في الرأس — مصدرٌ واحد لا قاموسٌ ثانٍ */
  labels: Record<string, string>;
  /** عنوانُ القسم — يغيب حين تكون الورقة كلُّها لهذا القسم */
  title?: string;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<TabPref[]>(prefs);

  /* كتابةٌ واحدة للمحورين: الحالة تُرسل كاملةً لا كفرقٍ عليها، فلا يمكن
     أن يصل الترتيبُ بلا الإخفاء أو العكس */
  function commit(next: TabPref[]) {
    if (next === local) return;
    tap(8);
    /* 🔒 🆕 **والعرضُ صار بلس** (D-819) — **والحارسُ في `setTabPrefs`**:
       **حارسٌ في العميل زينةٌ لا قفل**، **ومعاملٌ يُمرَّر عبر ستّة
       مكوّناتٍ كان يكلّف قراءةَ ملفٍّ حاجبةً في كلِّ فتحةِ صفحة** — انظر
       رأسَ الفعل. **والجوابُ يعود منه، فتفتح البوّابةُ عن حقيقةٍ لا عن
       تخمين.**
       ⚠️ **والتفاؤلُ يرتدّ إلى `prev` لا إلى `local`**: **`local` داخل
       المغلَّف هي لقطةُ الرسم لا الحالةُ بعد `setLocal`** — **وارتدادٌ
       إلى قيمةٍ قديمةٍ يترك اللوحَ على ترتيبٍ ثالثٍ لم يطلبه أحد.** */
    const prev = local;
    setLocal(next);
    start(async () => {
      const res = await setTabPrefs(surface, next);
      if (res?.needsPlus) {
        setLocal(prev);
        openPlusGate();
        return;
      }
      router.refresh();
    });
  }

  const shownCount = visibleTabs(local).length;

  return (
    <div>
      {title && (
        <p className="px-5 pt-3 pb-2 text-12 font-bold text-muted">{title}</p>
      )}
      <ul>
        {local.map((pref, i) => {
          const label = labels[pref.key] ?? pref.key;
          const lastVisible = !pref.hidden && shownCount <= 1;
          return (
            <li key={pref.key} className="flex items-center gap-1 pe-3">
              <button
                type="button"
                role="switch"
                aria-checked={!pref.hidden}
                disabled={lastVisible || pending}
                onClick={() => commit(toggleTab(local, pref.key))}
                className="min-w-0 flex-1 flex items-center justify-between gap-3 min-h-11 ps-5 pe-2 py-2 text-start text-15 rounded-e-xl hover:bg-surface-2 disabled:opacity-45 transition"
              >
                <span className="min-w-0 flex items-center gap-3">
                  <Icon name={pref.hidden ? "eye-off" : "eye"} size={18} />
                  <span className="truncate">{label}</span>
                </span>
                <span
                  aria-hidden
                  className={`shrink-0 h-5 w-9 rounded-full transition relative ${
                    pref.hidden ? "bg-border" : "bg-accent"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--background)] transition-all ${
                      pref.hidden ? "start-0.5" : "start-[18px]"
                    }`}
                  />
                </span>
              </button>

              {/* السهمان: مقاسُ لمسٍ كامل (٤٤×٤٤، رقم ١٦)، والرمزان
                  رأسيّان فلا ينقلبان مع الاتجاه — «فوق» فوقٌ في اللغتين */}
              <ArrowButton
                icon="chevron-up"
                label={t.tabsPrefsMoveUp(label)}
                disabled={i === 0 || pending}
                onClick={() => commit(moveTab(local, pref.key, -1))}
              />
              <ArrowButton
                icon="chevron-down"
                label={t.tabsPrefsMoveDown(label)}
                disabled={i === local.length - 1 || pending}
                onClick={() => commit(moveTab(local, pref.key, 1))}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ArrowButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: "chevron-up" | "chevron-down";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 grid place-items-center h-11 w-11 rounded-full text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent transition"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
