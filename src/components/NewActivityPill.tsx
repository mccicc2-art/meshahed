"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { tap } from "@/lib/haptics";
import { newFeedCount } from "@/lib/actions";
import { getDict, num, type Locale } from "@/lib/i18n";

/**
 * شارةُ «وصل جديد» العائمة (D-151) — تتمّة D-149.
 *
 * D-149 رتّب ما لم يُرَ **عند فتح الصفحة**. وهذه هي الحالة الأخرى: أنت
 * جالسٌ في التبويب وشخصٌ يكتب الآن. الخطّ لا يُقحم الجديد فوق ما تقرؤه —
 * **إقحامُ صفٍّ يقفز بما تحته وأنت تقرأ عطلٌ لا ميزة** — بل يعرض شارةً
 * ويترك القرار لك. وهذا هو العُرف، ولم نخترع له شكلاً.
 *
 * **الاستطلاع يتوقّف حين تختفي الصفحة** (`document.hidden`) — قاعدة D-067
 * حرفياً: تبويبٌ في الخلفية لا يستحقّ نداءً كل نصف دقيقة، وأربعون تبويباً
 * منسيّاً تكلفةٌ حقيقية على القاعدة.
 *
 * والضغطة تفعل شيئين: تُنعش الخطّ (فيعيد الخادم ترتيبه بـD-149، والجديد
 * يعلو) وترفعك إلى أعلاه. ثم تختفي الشارة لأن `FeedSeenSync` يختم من
 * جديد بعد الرسم.
 */
const EVERY_MS = 30_000;

export function NewActivityPill({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let dead = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const n = await newFeedCount();
        if (!dead) setCount(n);
      } catch {
        /* صمتٌ: شارةٌ غائبة أهون من رسالة خطأ على خطٍّ يُقرأ */
      }
    };
    const id = setInterval(check, EVERY_MS);
    const onShow = () => void check();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      dead = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <div className="sticky top-2 z-30 flex justify-center pointer-events-none">
      <button
        type="button"
        onClick={() => {
          tap(8);
          setCount(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
          router.refresh();
        }}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-accent text-[color:var(--on-accent)] text-[12px] font-bold px-3.5 py-2 shadow-lg active:scale-95 transition"
      >
        <Icon name="chevron-up" size={14} strokeWidth={2.6} />
        {t.feedNewCount(num(count, locale))}
      </button>
    </div>
  );
}
