"use client";

import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { chipClass, chipRow } from "./ui/controls";
import { saveListReview, deleteListReview } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, num, type Locale } from "@/lib/i18n";

/**
 * **صندوقُ تقييم القائمة ومراجعتِها — مُخرَجاً عند قارئه الثاني** (D-352).
 *
 * ================= لماذا خرج الآن ولم يخرج يومَ وُلد =================
 *
 * **كان له قارئٌ واحد** (لوحُ التقييمات في صفحة القائمة — D-327)،
 * **ومكوّنٌ يُخرَج لقارئٍ واحد تجريدٌ قبل أوانه** (D-002: يُخرَج عند
 * الثاني لا قبله). **وقد جاء ثانيه**: النجمةُ على بطاقة القائمة تفتحه
 * ورقةً (طلبُ أحمد: «أقدر أضغطها وأقيّم وأكتب تعليق مباشرة — شاشة
 * منبثقة»).
 *
 * **ونسخُه كان سيعني سلّمين يفترقان يوماً**: عشرُ رقائق هنا وخمسٌ هناك،
 * أو عَلَمُ حرقٍ يُنسى في إحداهما — **وهو بعينه ما تمنعه القاعدة ٦.**
 *
 * ================= ولا وصفةَ بصريّةً جديدة =================
 *
 * الرقائقُ عائلةُ التحكّم الثانية (D-016) · رقاقةُ الحرق بوصفة `Composer`
 * حرفاً (D-315) · والزرُّ من مصنع `Button` (D-017). **والنصُّ كلُّه من
 * القاموس القائم** — لا مفتاحَ جديداً لفعلٍ قديم.
 *
 * ⚠️ **والحالةُ تفاؤليّةٌ بحدّها** (D-241): الصندوقُ وحدَه يتفاءل — زرُّه
 * يُقفل وتظهر رسالةُ النجاح — **ولا يُرسم رأيٌ في خطِّ الآراء قبل أن
 * يصل**، لأن ذلك سطحٌ يقرؤه غيرُك.
 */
export function ListReviewForm({
  listId,
  locale,
  mine,
  onSaved,
}: {
  listId: string;
  locale: Locale;
  /** رأيي القائم — يملأ الصندوق فيكون التعديلُ تعديلاً لا كتابةً جديدة */
  mine: { rating: number; body: string | null; hasSpoiler: boolean } | null;
  /** تُنادى بعد حفظٍ ناجح — الورقةُ تُغلق بها، واللوحُ لا يحتاجها */
  onSaved?: () => void;
}) {
  const t = getDict(locale);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [spoiler, setSpoiler] = useState(mine?.hasSpoiler ?? false);
  const [saved, setSaved] = useState(!!mine);
  const [, start] = useTransition();

  function submit() {
    if (!rating) return;
    tap([12, 30]);
    setSaved(true);
    start(async () => {
      try {
        await saveListReview({ listId, rating, body, hasSpoiler: spoiler });
        toast(t.listReviewSave, { tone: "success" });
        onSaved?.();
      } catch (e) {
        setSaved(false);
        flashError((e as Error).message);
      }
    });
  }

  function removeMine() {
    tap(8);
    setSaved(false);
    setRating(0);
    setBody("");
    setSpoiler(false);
    start(async () => {
      try {
        await deleteListReview(listId);
        onSaved?.();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-12 font-semibold text-muted">{t.listReviewMine}</p>
      <div className={chipRow}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={rating === n}
            onClick={() => {
              tap(8);
              setRating(n);
              setSaved(false);
            }}
            className={chipClass(rating === n, "sm")}
          >
            <span dir="ltr">{num(n, locale)}</span>
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSaved(false);
        }}
        rows={3}
        maxLength={2000}
        placeholder={t.reviewPlaceholder}
        className="w-full rounded-control bg-surface-2 border border-border p-3 text-15 outline-none focus:border-accent/60"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          aria-pressed={spoiler}
          onClick={() => {
            tap(8);
            setSpoiler((v) => !v);
            setSaved(false);
          }}
          className={chipClass(spoiler, "sm")}
        >
          <Icon name={spoiler ? "eye-off" : "eye"} size={14} strokeWidth={2.2} />
          <span className="ms-1.5">{t.spoilerMark}</span>
        </button>

        <button
          type="button"
          disabled={!rating || saved}
          onClick={submit}
          className={`ms-auto ${buttonClass({ variant: "primary", size: "md" })}`}
        >
          {t.listReviewSave}
        </button>
        {mine && (
          <button
            type="button"
            onClick={removeMine}
            className={buttonClass({ variant: "ghost", size: "md" })}
          >
            {t.listReviewDelete}
          </button>
        )}
      </div>
    </div>
  );
}
