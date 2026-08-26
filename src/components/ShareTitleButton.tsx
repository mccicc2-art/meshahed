"use client";

import { siteUrl } from "@/lib/site";
import { toast } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { coverBareControl } from "./ui/controls";

/**
 * **مشاركةُ عملٍ برمزٍ واحد** (D-225، طلبُ أحمد: «أحتاج المشاركة»).
 *
 * **ورقةُ النظام أوّلاً ثم الحافظة** — نفسُ سلّم `DetailTopBar` حرفاً:
 * `navigator.share` إن وُجدت (فالجوّالُ يعرف أين يرسل أفضلَ منّا)، وإلّا
 * نسخُ الرابط وتوستٌ يقول إنه نُسخ. **وإغلاقُ ورقة النظام ليس خطأً** فلا
 * يُتبَع بنسخٍ لم يُطلب.
 *
 * **والرابط من `siteUrl()` وحدها** (D-064): `window.location.origin` يعطي
 * نطاقَ المعاينة في نشرات Vercel، **فيُشارَك رابطٌ يموت بعد أسبوع.**
 *
 * ⚠️ **دَينٌ مُعلَن:** `DetailTopBar` تكتب هذا المنطق بنفسها منذ D-051،
 * **فصارت نسختان** — والقاعدة أن المنسوخ يُوحَّد (D-145). تُهاجَر إلى هنا
 * يوم تُمسّ `DetailTopBar` لسببٍ آخر، لا في دفعةٍ تخصّ صفحةً أخرى.
 */
export function ShareTitleButton({
  path,
  title,
  locale,
  label,
  variant = "plain",
  className = "",
}: {
  /** مسارُ العمل عندنا — `/show/123` أو `/movie/456` */
  path: string;
  title: string;
  locale: Locale;
  /** 🆕 نصٌّ بجانب الرمز — لصفوف الأفعال حيث الرمزُ وحدَه سؤالٌ (D-138) */
  label?: string;
  /**
   * 🆕 **قرصٌ زجاجيٌّ فوق الغلاف** (D-561) — **`variant` لا مكوّنٌ ثانٍ**
   * (نفسُ عقد `ProfileMenu` و`BackButton` و`FollowUserButton`).
   *
   * **والمقاسُ ٤٤ لا ٤٠**: هو الحدُّ الأدنى للمسِ الإصبع (D-033/D-168)،
   * **وهو مقاسُ `BackButton` في الزاوية المقابلة** — **وقرصان متجاوران
   * بمقاسين يُقرآن رتبتين مختلفتين وهما رتبةٌ واحدة.**
   */
  variant?: "plain" | "cover";
  className?: string;
}) {
  const t = getDict(locale);

  async function run() {
    tap(6);
    const url = siteUrl(path);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // أغلق المستخدم ورقة المشاركة — ليس خطأً
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t.linkCopied);
    } catch {
      /* متصفّح بلا حافظة — لا رسالة تفيد هنا */
    }
  }

  const cover = variant === "cover";
  return (
    <button
      type="button"
      onClick={run}
      aria-label={t.shareLinkLabel}
      title={t.shareLinkLabel}
      className={
        /* 🆕 **والقرصُ سقط عن وجهِ الغلاف** (D-643، بحكمه) — **وهو
           تعميمُ D-288**: `black/35` شفّافةٌ لا سوداء، فعلى غلافٍ فاتحٍ
           تصير رماديّةً باهتةً وأيقونتُها `white/90` فوقها. **والظلُّ
           يفصلها عن أيِّ صورة.** **والمرئيُّ ٢٤ وهدفُ اللمس ٤٤**
           بـ`before` (D-033) — **لا هدفَ لمسٍ بحجم ما تراه العين.** */
        (cover
          ? coverBareControl
          : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-muted hover:text-accent transition active:scale-90") +
        ` ${className}`
      }
    >
      {/* 🆕 **٢٤ عارياً لا ١٨ داخل قرص** (D-643): **القرصُ كان يعطي
          الأيقونةَ حجماً بصريّاً لا تملكه**، وبسقوطه **صارت هي وحدَها
          ما يُرى** — **فتساوي جارَيها** (سهمُ الرجوع ٢٤ والنقاطُ ٢٤). */}
      <Icon name="share" size={cover ? 24 : 15} strokeWidth={cover ? 2.5 : undefined} />
      {!cover && label && <span className="text-14 font-bold">{label}</span>}
    </button>
  );
}
