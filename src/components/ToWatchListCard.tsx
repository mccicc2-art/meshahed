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

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      className={`block w-full h-full text-start rounded-2xl border bg-surface p-2.5 transition hover:bg-surface-2 active:scale-[0.99] disabled:opacity-70 ${
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
        /* ⚖️ 🆕 **والرقاقةُ خرجت إلى `PlayPill`** (D-563): طلبها أحمد
           على كلِّ بطاقةٍ لا على هذه وحدَها — **ونسخُها هناك كان سيصنع
           رقاقتين تفترقان عند أوّل تعديل** (القاعدة ٣/D-145). **الشكلُ
           واحدٌ والفعلُ مختلف**: هذه تكتب تفضيلَ الرئيسية، وتلك رايةَ
           قائمة. */
        action={<PlayPill on={on} locale={locale} />}
      />
    </button>
  );
}
