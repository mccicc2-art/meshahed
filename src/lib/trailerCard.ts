"use client";

/**
 * 🆕 **ما تتشاركه بطاقةُ الترايلر في سطحيها** (D-756) — الرايلُ في اكتشف
 * والعلفُ في `/trailers`.
 *
 * 🔴 **وثلاثُ وصفاتٍ كانت مكتوبةً مرّتين حرفاً** (`keyOf` و«الصوت»
 * و«أضف لمكتبتي») — **ونسخةٌ ثانيةٌ تفترق عند أوّل تعديلٍ في خانةٍ
 * منها** (القاعدة ٣ / D-002). **فبيتُها واحد.**
 *
 * ⚠️ **والنوعُ يُستورد نوعاً لا قيمة**: `trailers.ts` ملفٌّ `server-only`
 * — **و`import type` يُمحى عند الترجمة فلا يعبر شيءٌ إلى المتصفّح**
 * (وصفةُ D-734 نفسُها).
 */

import { useCallback, useState } from "react";
import { follow } from "@/lib/actions";
import { flashError } from "@/lib/toast";
import type { TrailerItem } from "@/lib/trailers";

/** **مفتاحُ البطاقة: الجهةُ والمعرّف** — ورقمٌ وحدَه يصطدم بين فيلمٍ ومسلسل */
export function trailerKeyOf(item: Pick<TrailerItem, "mediaType" | "tmdbId">): string {
  return `${item.mediaType}-${item.tmdbId}`;
}

/**
 * 🔴 🆕 **وهويّةُ البطاقة غيرُ هويّة العمل** (D-772) — **منذ صارت
 * البطاقةُ مقطعاً لا عملاً**: **عملٌ واحدٌ يملك أربعَ بطاقات**، **ومفتاحٌ
 * بالمعرّف وحدَه يجعل الأربعَ بطاقةً واحدةً في عين React وفي خانات
 * `useTrailerSlots` وفي مُعرّفِ المشغّل** — **فتُرسم واحدةٌ وتُهمل ثلاث.**
 * ⚠️ **والقديمُ باقٍ حيث الحكمُ للعمل لا للمقطع**: «ليس لي» تُخفي
 * **العملَ كلَّه** بمقاطعه (وهو الصواب: القارئُ رفض العملَ لا اللقطة)،
 * **و«أضف لمكتبتي» يتابع العملَ** — **ومفتاحٌ واحدٌ للحكمين كان سيُخفي
 * مقطعاً ويُبقي أخاه.**
 */
export function trailerClipKeyOf(
  item: Pick<TrailerItem, "mediaType" | "tmdbId" | "videoKey">,
): string {
  return `${item.mediaType}-${item.tmdbId}-${item.videoKey}`;
}

/** **ووجهةُ التفاصيل وصفةٌ واحدة** — مسارُ العمل يُبنى من جهته */
export function trailerTitleHref(item: Pick<TrailerItem, "mediaType" | "tmdbId">): string {
  return `/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`;
}

/* ⚖️ D-759: `useTrailerSound` حُذفت — الصوتُ صار حالةَ المتحكّم الواحد
   `TrailerPlayback` تُقرأ من المشغّل الفعليّ وتُكتب كوكيزَ بعد التحقّق
   (المواصفة خامسًا). الكوكي نفسُه (`trailerPrefs`) لم يتغيّر. */

/** **«أضف لمكتبتي» متفائلٌ ويتراجع عند الفشل** — والرمزُ صحٌّ بعد الوقوع */
export function useTrailerFollow() {
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const addToList = useCallback((item: TrailerItem) => {
    const key = trailerKeyOf(item);
    setAdded((previous) => new Set(previous).add(key));
    follow({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      posterPath: item.posterPath,
    }).catch((error) => {
      setAdded((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
      flashError((error as Error).message);
    });
  }, []);
  return { added, addToList };
}

/**
 * 🔴 🆕 **خاناتٌ ثابتةٌ يحلّ فيها البديلُ محلَّ الذاهب** (D-756).
 *
 * **كان المقطعُ الذي يرفضه يوتيوب يُحذف من الصفّ** — **فتزحف البطاقاتُ
 * كلُّها تحت الإصبع**، **وهو بعينه ما رفضته D-728 لـ«ليس لي» في
 * الرايل** («حذفٌ داخل صفٍّ يُمرَّر يزيح ما تحت الإصبع»). **والقاعدةُ
 * طُبِّقت على فعل القارئ ونُسيت في فعلِنا نحن.**
 *
 * 🔑 **والعلاجُ بدائلُ لا حذف**: **الخادمُ يرسل أكثرَ ممّا يُعرض**،
 * **فالذاهبُ يُستبدَل في خانته** — **صفرُ إزاحةٍ وصفرُ بطاقةٍ ميّتة.**
 * ⚠️ **ولا نداءَ إضافيّ**: **البدائلُ من المسبار نفسِه الذي كان يُقصّ
 * ويُرمى** (`PROBE` في `trailers.ts`) — **الثمنُ حقولٌ في الحمولة لا
 * رحلةُ شبكة.**
 * ⚠️ **وحين تنفد البدائلُ يُحذف** — **خانةٌ فارغةٌ في صفِّ ترايلراتٍ
 * أسوأُ من إزاحةٍ واحدة.**
 */
export function useTrailerSlots(items: TrailerItem[], count: number) {
  /**
   * ⚠️ **وحالةٌ تُبذَر مرّةً تتجمّد على أوّل حمولة**: **الخادمُ يعيد
   * الصفَّ عند تبديل التبويب وعند كلِّ قرعةٍ جديدة** (`drawKey`)،
   * **والمكوّنُ باقٍ في مكانه من الشجرة فلا يُعاد بناؤه** — **فتُعرض
   * بطاقاتُ التبويب السابق تحت عنوان التبويب الجديد.**
   * 🔑 **والبذرةُ بصمةُ المحتوى لا مرجعُ المصفوفة**: **المصفوفةُ جديدةٌ
   * في كلِّ رسمٍ خادميّ** — **ومقارنةُ المراجع كانت ستمسح كلَّ استبدالٍ
   * وقع.**
   * ⚠️ **والمؤشّرُ على البدائل حالةٌ لا مرجع**: **مرجعٌ يُكتب أثناء
   * الرسم يُكتب مرّتين حين يُعيد React الرسمَ للتحقّق** — **والثلاثةُ
   * تتبدّل معاً فبيتُها واحد.**
   */
  const signature = items.map(trailerClipKeyOf).join(",");
  const seedOf = (): { seed: string; slots: TrailerItem[]; spare: number } => ({
    seed: signature,
    slots: items.slice(0, count),
    spare: count,
  });

  const [state, setState] = useState(seedOf);
  const fresh = state.seed === signature ? state : seedOf();
  if (state.seed !== signature) setState(fresh);

  const retire = useCallback(
    (key: string) => {
      setState((previous) => {
        const at = previous.slots.findIndex((item) => trailerClipKeyOf(item) === key);
        if (at < 0) return previous;
        const slots = previous.slots.slice();
        const fill = items[previous.spare];
        if (fill) slots[at] = fill;
        else slots.splice(at, 1);
        return { ...previous, slots, spare: fill ? previous.spare + 1 : previous.spare };
      });
    },
    [items],
  );

  return { slots: fresh.slots, retire };
}
