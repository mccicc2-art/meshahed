import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { buttonClass } from "./ui/Button";

/**
 * الحالة الفارغة الموجَّهة لخطّ الأصدقاء (تقييم 9 Aug م٦).
 *
 * الجملة وحدها كانت تشخّص («تابع أشخاصاً…») ولا تداوي: أين أتابعهم؟
 * الزرّ يفتح البحثَ نفسَه الذي يفتحه «بحث» في الشريط السفليّ — الفراغ
 * يشرح نفسه ويحمل أول خطوةٍ للخروج منه في الموضع ذاته.
 *
 * ⚖️ 🆕 **ورابطٌ بعد أن كان ورقةً** (D-534): كان يفتح `TitleSearchSheet`
 * على وضع «أشخاص»، **وقد صار للأعضاء رقاقتُهم في صفحة البحث** — فالوجهةُ
 * `‎/search?type=members` **وسطحُ بحثٍ واحدٌ لا اثنان** (القاعدة ٦).
 * **وسقطت معه حالةُ عميلٍ وورقةٌ كانت تُحمَّل لأجل ضغطةٍ واحدة.**
 */
export function FeedEmptyCta({ locale, text }: { locale: Locale; text?: string }) {
  const t = getDict(locale);

  return (
    <div className="bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center space-y-4">
      <p className="text-sm text-muted">{text ?? t.feedEmpty}</p>
      <Link href="/search?type=members" prefetch={false} className={buttonClass({ size: "sm" })}>
        {t.feedEmptyCta}
      </Link>
    </div>
  );
}
