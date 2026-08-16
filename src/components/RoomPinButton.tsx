"use client";

import { useState, useTransition } from "react";
import { toggleRoomPin, setGlobalRoomPin } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";

/**
 * 🆕 **دبّوسُ تثبيت الغرفة** (D-301، طلبُ أحمد بلقطةٍ عليها دبّوس:
 * «احتاج هذي العلامة فوق بالزاوية، إذا ضغطت عليها يتثبّت»).
 *
 * ================= ⚠️ ولماذا ليس داخل البطاقة =================
 *
 * **البطاقةُ كلُّها رابطٌ واحدٌ إلى الغرفة** — **وزرٌّ داخل رابطٍ عطلٌ
 * يمسكه فحصُنا بعينه** (`button.closest('a')`، D-155/D-281): الضغطةُ
 * تُنتج فعلين، والقارئُ لا يعرف أيَّهما وقع.
 * **فالدبّوسُ أخٌ للرابط لا ابنٌ له**، مطلقُ الموضع في زاوية غلافٍ
 * نسبيّ. **وهو نظيرُ ما فعلته D-272 حين قُسِّم الرابطُ ولم يُنسخ
 * المكوّن.**
 *
 * ================= والحالةُ تفاؤليّةٌ بلا ارتداد =================
 *
 * **الدبّوسُ يمتلئ فورَ اللمس** — **وفعلٌ لا يُرى أثرُه في الحال يُقرأ
 * ساقطاً** (D-241/D-289). **وعند الفشل يُردّ ويُعلَن**، لأن التثبيت
 * ترتيبٌ يعتمد عليه صاحبُه.
 *
 * ⚠️ **ولا يعيد ترتيبَ الشاشة تحت الإصبع**: الترتيبُ يقع على الخادم في
 * الفتحة التالية — **وبطاقةٌ تقفز من مكانها بينما يقرؤها صاحبُها أسوأُ
 * من انتظارِ فتحةٍ** (D-008/D-046: لا شيء يتغيّر موضعُه بعد أن يُرسم).
 * **والامتلاءُ هو الإيصال.**
 */
export function RoomPinButton({
  tmdbId,
  mediaType,
  pinned: initial,
  locale,
  global = false,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  pinned: boolean;
  locale: Locale;
  /**
   * 🆕 **الدبّوسُ الإداريّ** (D-314) — **الزرُّ نفسُه بفعلٍ آخر لا
   * نسخةٌ ثانية** (القاعدة ٣): للإدارة وحدَها، يكتب تثبيتاً يراه
   * الجميع، **واسمُه يقولها** (D-216: زرٌّ يثبّت للناس لا يلبس اسمَ
   * زرٍّ يثبّت لصاحبه).
   */
  global?: boolean;
}) {
  const t = getDict(locale);
  const [pinned, setPinned] = useState(initial);
  const [pending, start] = useTransition();
  const labelOn = global ? t.talkUnpinAll : t.talkUnpin;
  const labelOff = global ? t.talkPinAll : t.talkPin;

  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={pinned ? labelOn : labelOff}
      title={pinned ? labelOn : labelOff}
      disabled={pending}
      onClick={(e) => {
        /* ⚠️ **ويُمنع الحدثُ عن الرابط تحته** — الدبّوسُ خارجَه في الشجرة
           **لكنه فوقه في الشاشة**، **ومن ضغط الزاوية لم يقصد أن يدخل.** */
        e.preventDefault();
        e.stopPropagation();
        const next = !pinned;
        tap(8);
        setPinned(next);
        start(async () => {
          try {
            if (global) await setGlobalRoomPin({ tmdbId, mediaType, on: next });
            else await toggleRoomPin({ tmdbId, mediaType, on: next });
          } catch {
            setPinned(!next);
          }
        });
      }}
      /* **٢٨ تُرى و٤٤ تُلمس** (D-033/D-168/D-281): علامةٌ صغيرةٌ عمداً
         تُمدّ منطقةُ لمسها لا حجمُها.
         **والظلُّ لا الطبقة**: الدبّوسُ يقف على غلافِ عملٍ قد يكون فاتحاً
         **وطبقةٌ شفّافةٌ ليست تبايناً** (D-003/D-256/D-288). */
      className={`absolute top-2 end-2 z-10 w-7 h-7 grid place-items-center rounded-full transition
        before:absolute before:-inset-[8px] before:content-['']
        active:scale-90 disabled:opacity-50 ${
          pinned ? "text-accent drop-shadow" : "text-white/70 hover:text-white drop-shadow"
        }`}
    >
      <Icon name={pinned ? "pin-filled" : "pin"} size={17} strokeWidth={2.2} />
    </button>
  );
}
