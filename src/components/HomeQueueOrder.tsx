"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHomeQueueOrder } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { Icon } from "./Icon";
import { ReorderSheet, type ReorderItem } from "./ReorderSheet";

/**
 * 🆕 **أولويّةُ المشاهدة من رأس الصفِّ نفسِه** (D-605، حكمُ أحمد بلقطتين:
 * «خلها زرّ واحد — إذا ضغطته ما أبغاه يودّيني المكتبة أو أرتّب عناوين
 * الهوم، لا. أبغاها أقدر أرتّب الأفلام نفسها نفس الي عامله في
 * البروفايل، بحيث أقدر أشوف القائمة كاملة عندي في تو واتش بضغطة زر أو
 * كنتنيو واتشينغ بضغطة زر وأرتّب أولويّة المشاهدة»).
 *
 * ================= ⚖️ نقضٌ محصورٌ لـD-595 بحكم صاحبها =================
 *
 * مقبضُ «تابِع المشاهدة» و«للمشاهدة» كان يفتح ورقةَ ترتيب **الأقسام**
 * (D-595) وبجواره «الكلّ» — **وصارت الضغطةُ على مقبض هذين الصفَّين
 * تفتح قائمةَ **عناصرهما** كاملةً للسحب** (نموذجُ مفضّلة الملفّ D-567
 * بورقته `ReorderSheet` بعينها — القاعدة ٦). **وسائرُ الأقسام على
 * مقبض D-595 كما هي**، فترتيبُ الأقسام بابُه باقٍ هناك وفي التخصيص.
 * **و«الكلّ» سقط من الرأسين لا من الباب**: العنوانُ نفسُه ما زال
 * رابطَ المكتبة (D-378/D-422) — **فما سقط إلا التكرار.**
 *
 * ⚠️ **والورقةُ واحدةٌ تُركَّب مرّةً والزرّان يناديانها بحدث نافذة**
 * (نمطُ `HomeOrderSheetHost`/D-538): الصفّان يبثّان في `Suspense`
 * منفصلَين، والحدثُ يقطع جرَّ الخيط عبرهما.
 */

export const HOME_QUEUE_EVENT = "loopz:queue-order";
/** 🆕 وصفُّ «قوائمي» ثالثُ الصفوف (D-615): «والليست في الهوم احتاج
    أقدر أرتّبهم كذلك مثل الأفلام والمسلسلات» — نفسُ الزرِّ ونفسُ الورقة */
export type QueueRow = "continue" | "towatch" | "lists";

/** الزرُّ — وحيدُ الرأسِ في الصفَّين، بوصفة مقبض المفضّلة (D-567) حرفاً */
export function QueueOrderButton({ row, label }: { row: QueueRow; label: string }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      onClick={() => {
        tap(6);
        window.dispatchEvent(new CustomEvent(HOME_QUEUE_EVENT, { detail: row }));
      }}
      className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent active:scale-90 transition"
    >
      <Icon name="grip" size={18} />
    </button>
  );
}

/** مضيفُ الورقة — يُركَّب مرّةً في رأس الرئيسية ويملك الحالةَ والكاتب */
export function HomeQueueSheetHost({
  locale,
  cont,
  towatch,
  lists = [],
}: {
  locale: Locale;
  /** عناصرُ «تابِع المشاهدة» كلُّها بترتيب عرضها الحاليّ — بذرةُ الورقة */
  cont: ReorderItem[];
  /** عناصرُ «للمشاهدة» كلُّها بترتيب عرضها الحاليّ */
  towatch: ReorderItem[];
  /** 🆕 بطاقاتُ «قوائمي» بترتيب عرضها الحاليّ (D-615) — اختياريٌّ
      بفراغٍ لا واجبٌ: **رفعةُ المكوّنات تسبق رفعةَ الصفحة وتُبنى
      وحدَها** (D-028)، والغائبُ بلا زرِّه لا يُفتح أصلاً */
  lists?: ReorderItem[];
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [row, setRow] = useState<QueueRow | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "continue" || d === "towatch" || d === "lists") setRow(d);
    };
    window.addEventListener(HOME_QUEUE_EVENT, onOpen);
    return () => window.removeEventListener(HOME_QUEUE_EVENT, onOpen);
  }, []);

  if (!row) return null;
  return (
    <ReorderSheet
      items={row === "continue" ? cont : row === "lists" ? lists : towatch}
      t={t}
      onClose={() => setRow(null)}
      onDone={(keys) => {
        const saved = row;
        setRow(null);
        start(async () => {
          try {
            await saveHomeQueueOrder(saved, keys);
            /* الرسمُ خادميٌّ — التحديثُ يعيد الصفَّ بأولويّته الجديدة */
            router.refresh();
          } catch (err) {
            flashError((err as Error).message);
          }
        });
      }}
    />
  );
}
