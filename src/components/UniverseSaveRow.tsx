import { ListSaveHeart } from "./ListSaveHeart";
import type { Locale } from "@/core/i18n";

/**
 * **«احفظ هذا العالَم» في ترويسة الفيلم** — القلبُ نفسُه بكلمةٍ بجانبه
 * (D-347).
 *
 * ================= لماذا كلمةٌ هنا ورمزٌ وحدَه هناك =================
 *
 * **لأن السياق يحدّ ما يُفهم بلا كلمة**: على بطاقة القائمة الرمزُ في
 * زاوية شيءٍ اسمُه ظاهرٌ فوقه — **فيُقرأ «احفظ هذه»** (D-204). وهنا هو
 * زرٌّ منفردٌ في عمود أزرارِ ترويسةٍ لا يقول أيَّ شيءٍ يحفظ، **ورمزٌ
 * وحدَه في هذا الموضع سؤالٌ لا فعل** (D-138: أداةٌ لا تُفهم لا تُستعمل).
 *
 * **ولا زرٌّ ثانٍ ولا حالةٌ ثانية**: القلبُ هو `ListSaveHeart` نفسُه بكلِّ
 * تفاؤليّته وحارسه، **والكلمةُ عنصرٌ مجاورٌ لا داخلَه** — فلا تُنسخ
 * منطقةُ فعلٍ لتُلبَس ثوباً (D-002/D-145).
 */
export function UniverseSaveRow({
  listId,
  saved,
  label,
  locale,
}: {
  listId: string;
  saved: boolean;
  label: string;
  locale: Locale;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface ps-2.5 pe-1 h-9 text-14 font-semibold text-foreground/85">
      <span className="truncate">{label}</span>
      <ListSaveHeart listId={listId} saved={saved} locale={locale} />
    </span>
  );
}
