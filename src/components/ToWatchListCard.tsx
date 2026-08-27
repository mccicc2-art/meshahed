"use client";

import { useState, useTransition } from "react";
import { setToWatchQueue } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { posterUrl } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { Icon } from "./Icon";
import { ListCardShell } from "./PublicListsRail";
import { PlayPill } from "./ListPlayToggle";
import { HOME_QUEUE_EVENT } from "./HomeQueueOrder";

/**
 * **«للمشاهدة» بطاقةً في قوائم المكتبة** (D-559، بلاغُ أحمد: «تو واتش
 * خليها تكون ليست في قائمة الليستات بالمكتبة بحيث أقدر أشغّلها
 * وأوقفها وقت ما أبغى — حالياً أنا ما أبغى أشوفها، أبغى الليست الي
 * جنبها فقط وهي جات معها»).
 *
 * ================= الشكوى، وما تكشفه =================
 *
 * **الطابورُ كان الوحيدَ في «تابِع المشاهدة» بلا مفتاح.** قوائمُك
 * الحقيقيّةُ تدخل الصفَّ برايةٍ ترفعها من صفحتها (`is_playlist`،
 * D-505)، **وهذا يدخل بحكم الحساب** — فمن أراد جارتَه وحدَها لم يجد
 * ما يوقفه. **وميزةٌ تُفرض ولا تُردّ ليست ميزة.**
 *
 * ⚠️ **ولماذا ليست قائمةً حقيقيّةً في `user_lists`** (وهو نصُّ طلبه):
 * **تعريفُ الطابور نفسُه يمنعه** — «أفلامُك التي **لا قائمةَ لها**».
 * **فلو صار صفّاً في جدول القوائم لصار كلُّ فيلمٍ فيه ذا قائمة،
 * فأفرغ نفسَه في اللحظة التي يُنشأ فيها.** **والمطلوبُ ليس الجدولَ
 * بل ما يعطيه الجدول**: **أن تراها بين قوائمك، وأن تملك مفتاحَها** —
 * **وكلاهما هنا، بلا هجرةٍ ولا صفّ.**
 *
 * **ولذلك بطاقةٌ لا رابط**: `ListCardShell` نفسُها التي تلبسها قوائمُك
 * — **فتُقرأ من بينها لا غريبةً عنها** — **وضغطتُها تقلب الرايةَ لا
 * تفتح صفحةً لا وجودَ لها** (D-030: لا بابَ يُوعَد به ولا يوجد).
 * **ومحتواها ليس محجوباً**: هي أفلامُ مكتبتك، **وتبويبُ «الأفلام»
 * بجوارها يعرضها كلَّها.**
 *
 * ⚠️ **والحالةُ مكتوبةٌ بالكلمة لا باللون وحدَه** (D-142): رقاقةٌ
 * تقول «تعمل» أو «متوقّفة» — **وبطاقةٌ باهتةٌ بلا كلمة تُقرأ عطلاً
 * لا اختياراً.**
 *
 * **ومتفائلٌ مع تراجُع** (D-007) كرايةِ القائمة الحقيقيّة حرفاً.
 */
export function ToWatchListCard({
  locale,
  initialOn,
  count,
  posters,
}: {
  locale: Locale;
  initialOn: boolean;
  /** عددُ أفلامك التي لا قائمةَ لها — **هو عددُ القائمة نفسِه** */
  count: number;
  /** ثلاثةُ ملصقاتٍ من رأس الطابور — كبطاقة أيِّ قائمة */
  posters: (string | null)[];
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(initialOn);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    tap(next ? [12, 30] : 8);
    setOn(next);
    start(async () => {
      try {
        await setToWatchQueue(next);
        toast(next ? t.listPlaylistOnToast : t.listPlaylistOffToast);
      } catch (e) {
        setOn(!next);
        flashError((e as Error).message);
      }
    });
  }

  /**
   * 🆕 **والضغطةُ صارت تفتح** (D-719، حكمُه: «إذا ضغطتها أبغاها تنفتح،
   * أحتاج أرتّب تسلسل الأفلام فيها»).
   *
   * ⚖️ **نقضٌ لشطرِ D-559** («ضغطتُها تقلب الرايةَ لا تفتح صفحةً لا
   * وجودَ لها») — **والحجّةُ لم تُخطئ يومَها، ماتت**: **البابُ صار
   * موجوداً** (ورقةُ الترتيب D-605)، **وD-030 تمنع الوعدَ بما لا يوجد
   * لا بناءَ ما يُوعَد به.**
   * 🔑 **والمفتاحُ لم يسقط، انتقل إلى رقاقته**: **الرقاقةُ هي التي
   * تقول «تعمل/متوقّفة» أصلاً** (D-142/D-677) — **فهي أصدقُ موضعٍ
   * لقلبها من البطاقة كلِّها.**
   *
   * ⚠️ **والغلافُ `div` بدور زرٍّ لا `button`**: **زرٌّ داخل زرٍّ
   * يفكّه المحلّل** (يُغلق الخارجيُّ عند رؤية الداخليّ) — **وبطاقةُ
   * القائمة الحقيقيّة تنجو لأن غلافَها `a`**، وهذه لا رابطَ لها.
   */
  function open() {
    tap(6);
    window.dispatchEvent(new CustomEvent(HOME_QUEUE_EVENT, { detail: "towatchlist" }));
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      aria-label={t.libToWatch}
      className={`block w-full h-full text-start rounded-2xl border bg-surface overflow-hidden transition hover:border-accent/40 active:scale-[0.99] cursor-pointer ${
        on ? "border-border" : "border-dashed border-border"
      }`}
    >
      <ListCardShell
        name={t.libToWatch}
        /* **رمزُ العلامة قبل الاسم** — نفسُ موضع رمز قوائم لوبز، **يقول
           إنها قائمةٌ تُبنى وحدَها لا واحدةً أنشأتَها** */
        icon={<Icon name="bookmark" size={15} style={{ color: "var(--accent)" }} />}
        countText={t.listCount(count)}
        /* **الفاصلُ على عاتق المستدعي** — عُرفُ `extra` في الهيكل
           (قارئُ `/news` يمرّره بفاصله)، **ومقيسٌ على المنشور بدونه:
           «34 titlesBuilt from…» ملتصقتين.** */
        extra={` · ${t.toWatchAutoNote}`}
        posters={posters.map((p) => posterUrl(p, "w185")).filter(Boolean) as string[]}
        /* ⚖️ 🆕 **والرقاقةُ في شريط الحال كأخواتها** (D-563/D-677) —
           **بلا ♥ و💬 و★ عمداً**: الطابورُ ليس قائمةً في القاعدة فلا
           حفظَ له ولا رأيَ ولا تقييمَ **أبداً** — **وخانةٌ لا يمكن أن
           تتحرّك يوماً كذبةٌ لا توحيد** (D-217؛ استثناءٌ مُعلَنٌ من
           لقطته التي رسمت أصفاراً عليه). */
        /* **والمفتاحُ زرُّه** (D-719) — و`stopPropagation` تمنع أن
           تُقرأ ضغطتُه فتحاً للورقة. */
        play={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            disabled={pending}
            aria-pressed={on}
            aria-label={t.libToWatch}
            className="shrink-0 active:scale-95 transition disabled:opacity-60"
          >
            <PlayPill on={on} locale={locale} />
          </button>
        }
      />
    </div>
  );
}
