"use client";

import { useState, useTransition } from "react";
import { follow, unfollow } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError, toast } from "@/lib/toast";
import { Icon } from "./Icon";

/**
 * **زرُّ «+ للمشاهدة» على الملصق** (D-205، مواصفةُ أحمد لاكتشف: «A quick +
 * button can be displayed directly on the content card so the user can add a
 * title to To Watch **without opening its details page**»).
 *
 * ================= لماذا هو أثمنُ ممّا يبدو =================
 *
 * **رحلةُ الحفظ اليوم أربعُ لمسات:** ملصق ← صفحةُ العمل ← «أضف لقائمة» ←
 * رجوع. **ومن يتصفّح اكتشف يمرّ على عشرين عملاً في دقيقة** — فأيُّ عملٍ
 * يعجبه يكلّفه مغادرةَ الصفّ الذي يتصفّحه وفقدانَ موضعه فيه. **فالحفظُ
 * الذي لا يقطع التصفّح هو ما يجعل «اكتشف» يفضي إلى «مكتبتي» أصلاً** — وهو
 * جملةُ أحمد: «This makes Discover focused on finding what to watch».
 *
 * ================= ثلاثةُ قرارات =================
 *
 * **١ · فعلٌ واحد يقلب لا فعلان.** الزرُّ يُضيف، وبعد الإضافة **يصير
 * علامةَ صحٍّ تُزيل** — وهو ما طلبه («Remove → Remove from To Watch if
 * already added»). **ولا زرَّ حذفٍ ثالث** بجانبه: زرّان على ملصقٍ عرضُه
 * ١١٢px يجعلان الملصقَ لوحةَ أزرار.
 *
 * **٢ · «شاهدته» ليس هنا.** مواصفتُه تذكره، **وموضعُه دائرةُ ✓ في صفحة
 * العمل** (D-047) — **ولأن التأشير يفتح ورقةَ التقييم فوراً** (D-158/D-192)
 * فوضعُه على ملصقٍ في صفٍّ يُمرَّر يعني ورقةً تنبثق في وجه من كان يتصفّح.
 * **فعلٌ يقطع التصفّح لا يوضع في أداةٍ صُنعت كي لا تقطعه.**
 *
 * **٣ · تفاؤليٌّ بلا تجديد.** الحالةُ تُقلب فوراً وتُراجَع إن فشلت
 * الكتابة، **ولا `router.refresh()`**: الفعلُ يُبطل `/` و`/library` على
 * الخادم (انظر `follow`)، فأوّلُ تنقّلٍ طبيعي يقرأ الحقيقة — **وتجديدُ
 * صفحةٍ فيها ستّةُ رفوفٍ ثمناً لعلامةٍ واحدة هدرٌ صافٍ** (نمط D-124).
 *
 * ⚠️ **وحالتُه الابتدائية تأتي من المستدعي لا من نداءٍ هنا:** لو سأل كلُّ
 * ملصقٍ عن نفسه لصارت رسمةُ اكتشف مئةَ استعلام. والصفحاتُ التي تعرف
 * متابعاتِ القارئ تمرّرها، **ومن لا يعرفها يمرّر `false`** — فالأسوأُ أن
 * يظهر الزرُّ «مضافاً» وهو ليس كذلك، والعكسُ يُصلحه أوّلُ لمس (`upsert`).
 */
export function QuickAdd({
  tmdbId,
  mediaType,
  title,
  posterPath,
  added = false,
  locale,
  variant = "corner",
  className = "",
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /** هل هو في «للمشاهدة» أصلاً؟ — يُمرَّر ولا يُسأل عنه (انظر أعلاه) */
  added?: boolean;
  locale: Locale;
  /**
   * **موضعان لفعلٍ واحد** (D-224 — امتدادُ D-205/D-207، لا نسخةٌ منه).
   *
   * `corner`: قرصٌ مطلَقٌ في زاوية الملصق — الأصل، وسطحُه شبكاتُ الملصقات.
   * `inline`: زرٌّ في صفٍّ من أفعال، بعلامة **مِرجَعية** (`bookmark`) لا `+`.
   *
   * **ولماذا امتدادٌ لا مكوّنٌ ثانٍ:** المنطقُ كلُّه واحد — تفاؤليٌّ بلا
   * تجديد، ونفسُ `follow`/`unfollow`، ونفسُ التوست، ونفسُ حجّة «الحالة من
   * المستدعي». **والمختلفُ الرسمُ وحده** — ومكوّنٌ ثانٍ لأجل الرسم كان
   * سيصير عائلةً ثانية للحفظ (قاعدةُ «لا عائلة ثانية لأي شيء»).
   *
   * ⚠️ **والرمزُ يختلف لأن الموضع يختلف:** على الملصق لا نصَّ يشرح، فـ`+`
   * أوضحُ رمزٍ للإضافة. **وفي صفٍّ من أفعالٍ نصّية** بجانب «تعليق»
   * المِرجَعيةُ هي العُرف الراسخ للحفظ — **واتّباعُ عُرفٍ راسخ ميزةٌ لا
   * كسل** (D-150).
   */
  variant?: "corner" | "inline";
  className?: string;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(added);
  const [pending, start] = useTransition();

  function run(e: React.MouseEvent) {
    /* الملصقُ كلُّه رابط — فالزرُّ يمنع الانتقال عن نفسه، وإلا فُتحت
       صفحةُ العمل مع كل حفظٍ وهو نقيضُ سبب وجوده */
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    tap(on ? 8 : [12, 30]);
    const next = !on;
    setOn(next);
    start(async () => {
      try {
        if (next) {
          await follow({ tmdbId, mediaType, title, posterPath });
          toast(t.quickAddDone);
        } else {
          await unfollow({ tmdbId, mediaType });
        }
      } catch (err) {
        setOn(!next);
        flashError((err as Error).message);
      }
    });
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-pressed={on}
        aria-label={on ? t.quickAddRemove : t.quickAddLabel}
        title={on ? t.quickAddRemove : t.quickAddLabel}
        /* نفسُ حشوة جيرانه في الذيل، فلا يخرج زرٌّ عن صفٍّ واحد */
        className={`inline-flex items-center rounded-full px-2.5 py-1.5 transition active:scale-90 disabled:opacity-60 ${
          on ? "text-accent" : "text-muted hover:text-accent"
        } ${className}`}
      >
        <Icon name="bookmark" size={15} className={on ? "fill-current" : undefined} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? t.quickAddRemove : t.quickAddLabel}
      title={on ? t.quickAddRemove : t.quickAddLabel}
      /* أعلى الملصق في الجهة الخاتمة: أسفلُه محجوزٌ لشارة التقييم
         (`IMDb 8.6`)، ومنتصفُه هو الصورة. وخلفيةٌ صمّاء بضبابةٍ خفيفة كي
         يُقرأ الرمزُ على ملصقٍ فاتحٍ أو غامق — **ولا `opacity-0` على زرٍّ
         حقيقيّ** (D-142: أداةٌ لا تُرى لا توجد، والجوالُ بلا مرور). */
      className={`absolute top-1.5 end-1.5 z-10 grid place-items-center w-8 h-8 rounded-full border backdrop-blur-md transition active:scale-90 disabled:opacity-60 ${
        on
          ? "bg-accent text-[color:var(--on-accent)] border-accent"
          : "bg-black/45 text-white border-white/20 hover:bg-black/65"
      } ${className}`}
    >
      <Icon name={on ? "check" : "plus"} size={17} strokeWidth={2.4} />
    </button>
  );
}
