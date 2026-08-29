"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * 🆕 **صورةُ الترحيب بابٌ مباشرٌ إلى الملفّ** (D-774، حكمُ أحمد بلقطةٍ
 * محوَّطة: «الي يضغط على الصورة يروح للبروفايل مباشرة بدون القائمة
 * المنسدلة»).
 *
 * ⚖️ **وهذا نقضٌ صريحٌ لـD-620 بيد صاحبه** — وكان نصُّه: «خلّ الشخص إذا
 * ضغط على الصورة تطلع قائمة صغيرة… ويختار إعدادات أو بروفايل». **فسقطت
 * القائمةُ وسقط معها `HomeAvatarMenu`.**
 *
 * 🔑 **ولم يضع البابُ الثاني**: حجّةُ D-620 كانت أنّ ترسَ الإعدادات
 * حُذف فاحتاجت وجهتُه باباً — **والترسُ عاد إلى صفِّ الأيقونات في هذه
 * الجولة نفسِها** (حكمُه: «الإعدادات رجّعها فوق»). **فالقائمةُ كانت
 * جسراً لبابٍ غائب، وقد عاد البابُ فسقط الجسر** — **ولا وجهةَ بلا
 * باب، ولا بابان لوجهةٍ واحدة** (D-145 من جهة الأبواب).
 *
 * ⚠️ **والهلالُ ومداره لم يتبدّلا**: حلقةُ المستوى المخروطيّةُ نفسُها
 * حرفاً — **الذي تبدّل أنّ الضغطةَ تنتقل بدل أن تفتح.**
 * ⚠️ **ويبقى مكوّنَ عميلٍ لأجل النقرة اللمسيّة وحدَها** (`tap`):
 * **ضغطةٌ بلا ردٍّ لمسيٍّ في هدفٍ كبيرٍ تُقرأ ضغطةً لم تصل.**
 */
export function HomeAvatarLink({
  locale,
  name,
  avatarUrl,
  avatarPos,
  levelPercent,
}: {
  locale: Locale;
  name: string;
  avatarUrl?: string | null;
  avatarPos?: number | null;
  levelPercent?: number;
}) {
  const t = getDict(locale);
  return (
    <Link
      href="/profile"
      prefetch={false}
      aria-label={t.profile}
      title={name || t.profile}
      onClick={() => tap(6)}
      className="block shrink-0 rounded-full p-[2px] active:scale-95 transition"
      style={
        levelPercent && levelPercent > 0
          ? { background: `conic-gradient(var(--accent) ${levelPercent}%, var(--border) 0)` }
          : undefined
      }
    >
      <span className="block rounded-full p-[2px] bg-[color:var(--background)]">
        <Avatar src={avatarUrl} name={name} size={44} posY={avatarPos} alt={t.avatarAlt} />
      </span>
    </Link>
  );
}
