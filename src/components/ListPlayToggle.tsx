"use client";

import { useState, useTransition } from "react";
import { setListPlaylist, setSavedListPlaylist } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";

/**
 * 🆕 **رقاقةُ التشغيل/الإيقاف — شكلٌ واحدٌ لمعنًى واحد** (D-563).
 *
 * **وُلدت داخل `ToWatchListCard`** (D-559) **ثم طلبها أحمد على كلِّ
 * بطاقة** — **فخرجت إلى ملفٍّ مشترك بدل أن تُنسخ**: **ثاني نسخةٍ من
 * رقاقةِ حالةٍ خللٌ** (القاعدة ٣)، **ولو نُسخت لافترق لونُها أو
 * ارتفاعُها عند أوّل تعديل** (D-145).
 *
 * ⚠️ **والحالةُ مكتوبةٌ بالكلمة لا باللون وحدَه** (D-142): «تعمل» أو
 * «متوقّفة» — **ورقاقةٌ باهتةٌ بلا كلمة تُقرأ عطلاً لا اختياراً.**
 */
export function PlayPill({ on, locale }: { on: boolean; locale: Locale }) {
  const t = getDict(locale);
  /* ⚖️ 🆕 **الكلمةُ وقرصُها بدل الرمز** (D-677، لقطتا أحمد: «On ●» /
     «Off ○») — **الحالةُ ما زالت مكتوبةً بالكلمة** (D-142)، **والقرصُ
     لبوسُ مفتاحٍ يُقرأ قابلاً للقلب** — ورمزُ التشغيل كان يُقرأ زرَّ
     تشغيلِ محتوًى (D-030). */
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full ps-3 pe-1.5 h-7 text-12 font-bold border transition ${
        on
          ? "border-accent/60 bg-surface-2 text-accent"
          : "border-border bg-surface-2 text-muted"
      }`}
    >
      {on ? t.toWatchOn : t.toWatchOff}
      <span
        aria-hidden
        className={`w-4 h-4 rounded-full ${on ? "bg-accent" : "bg-[color:var(--divider)]"}`}
      />
    </span>
  );
}

/**
 * 🆕 **رايةُ «قائمة التشغيل» مفتاحاً على بطاقة القائمة** (D-563، بلاغُ
 * أحمد: «عجبني زر On و Off، أبغاه موجود في كل اللستات — مو لازم أدخل
 * بالداخل وأعمل ستارت واتشينج»).
 *
 * ================= ما تكشفه الشكوى =================
 *
 * **الرايةُ موجودةٌ منذ D-505** — **وصفرُ قوائمَ في القاعدة كلِّها
 * رفعتها.** **وميزةٌ لا يجدها أحدٌ ليست مشحونة**، وسببُ الاختفاء
 * مكتوبٌ في مسارها: صفحةُ القائمة ← ورقةُ الأدوات ← صفٌّ سادس. **ثلاثُ
 * ضغطاتٍ لقلبِ رايةٍ يقلبها المفتاحُ في واحدة.**
 *
 * **ولماذا لا يُحذف الصفُّ من الورقة**: هو بيتُ الفعل حين تكون **داخل**
 * القائمة، والمفتاحُ بيتُه حين تكون **فوقها** — **ونفسُ الفعلِ ونفسُ
 * الكاتب** (`setListPlaylist`)، **فلا بابان يفترقان** (D-462).
 *
 * ⚠️ **وزرٌّ داخل بطاقةٍ رابط**: الحدثُ يُوقَف عنده (D-339/D-155)
 * **وإلّا قلب الرايةَ وفتح الصفحةَ في لمسةٍ واحدة** — نفسُ حصانةِ زرِّ
 * المشاركة بجانبه حرفاً.
 *
 * **ومتفائلٌ مع تراجُع** (D-007) — كرايةِ صفحة القائمة سواءً بسواء.
 */
export function ListPlayToggle({
  listId,
  locale,
  initialOn,
  saved = false,
}: {
  listId: string;
  locale: Locale;
  initialOn: boolean;
  /** 🆕 **قائمةٌ حفظتُها من غيري** (D-674) — **الكاتبُ صفُّ حفظي لا
      صفُّ القائمة**: **المعنى واحدٌ في العين والمالكُ اثنان في القاعدة.** */
  saved?: boolean;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(initialOn);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={t.listPlaylist}
      title={t.listPlaylist}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        tap(next ? [12, 30] : 8);
        setOn(next);
        start(async () => {
          try {
            await (saved ? setSavedListPlaylist : setListPlaylist)(listId, next);
            toast(next ? t.listPlaylistOnToast : t.listPlaylistOffToast);
          } catch (err) {
            setOn(!next);
            flashError((err as Error).message);
          }
        });
      }}
      className="shrink-0 active:scale-95 transition disabled:opacity-60"
    >
      <PlayPill on={on} locale={locale} />
    </button>
  );
}
