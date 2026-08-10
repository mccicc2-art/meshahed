"use client";

import { useEffect } from "react";
import { markFeedSeen } from "@/lib/actions";

/**
 * ختمُ «رأيتُ خطّي» بعد الرسم (D-149) — عميلٌ غير مرئيّ، على نمط
 * `ShowStatsSync` و`MetaSync`.
 *
 * لماذا مكوّنٌ لا نداءٌ في الصفحة: الصفحة مكوّنُ خادم، وختمُها هناك يقع
 * **قبل** أن تصل البكسلات إلى العين — فيسقط علوُّ الجديد في نفس الزيارة
 * التي جاء ليُريها. الختم بعد التركيب يعني: هذه الزيارة تراه عالياً،
 * والتالية تراه في مكانه.
 *
 * و`stamp` في التبعيّات كي يُختم مرّةً لكل موجة أحداث: من يبقى في التبويب
 * ويصله جديدٌ بالاستطلاع يُختم له من جديد، ومن يعيد الرسم بلا جديدٍ لا
 * يدفع نداءً.
 */
export function FeedSeenSync({ stamp }: { stamp: number }) {
  useEffect(() => {
    if (!stamp) return;
    void markFeedSeen();
  }, [stamp]);
  return null;
}
