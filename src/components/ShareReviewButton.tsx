"use client";

import { useState } from "react";
import { siteUrl } from "@/lib/site";
import { copiedToast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";
import { Icon } from "./Icon";
import { Dropdown, DropdownRow } from "./ui/Dropdown";

/**
 * ====== 🆕 T530 — مشاركةُ المراجعة نفسِها (أحمد ٢٣ نوفمبر «١أ») ======
 *
 * كان زرُّ المشاركة في صفحة المراجعة يشارك صفحةَ **العمل** (`ShareTitleButton` برابط العمل) — فمن شارك رأيه شارك اسمَ الفيلم.
 * الآن يشارك رابطَ المراجعة، **ومراجعةٌ فيها نصٌّ تسأل أوّلاً**: «المراجعة كاملة» أم «التقييم فقط» (`?card=rating` — الصفحةُ تختار
 * صورتَها في X منه). رأيٌ بلا نصٍّ يُشارك مباشرةً: صورتُه التقييمُ أصلاً. وجهُ الزرّ وجهُ `ShareTitleButton` نفسُه، والقائمةُ
 * المنسدلةُ الواحدة (`Dropdown`).
 */
export function ShareReviewButton({ path, title, hasText, locale }: { path: string; title: string; hasText: boolean; locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  async function run(ratingOnly: boolean) {
    setOpen(false);
    tap(6);
    const url = siteUrl(ratingOnly ? `${path}?card=rating` : path);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // أغلق ورقةَ المشاركة — ليس خطأً
    }
    try {
      await navigator.clipboard.writeText(url);
      copiedToast(t.linkCopied);
    } catch {
      /* متصفّحٌ بلا حافظة */
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => (hasText ? setOpen((o) => !o) : void run(false))}
        aria-label={t.shareReviewTitle}
        title={t.shareReviewTitle}
        aria-haspopup={hasText ? "menu" : undefined}
        aria-expanded={hasText ? open : undefined}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-muted hover:text-accent transition active:scale-90"
      >
        <Icon name="share" size={15} />
      </button>
      {hasText ? (
        <Dropdown open={open} onClose={() => setOpen(false)} align="end" className="text-base font-normal">
          <DropdownRow icon="comment" label={t.shareReviewFull} onClick={() => void run(false)} />
          <DropdownRow icon="star" label={t.shareReviewRating} onClick={() => void run(true)} />
        </Dropdown>
      ) : null}
    </span>
  );
}
