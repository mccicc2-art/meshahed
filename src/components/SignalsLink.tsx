import Link from "next/link";
import { getDict, num, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * **جرسُ الإشعارات — بابُه تبويبُ «التنبيهات» في `‎/messages`** (D-536).
 *
 * ⚖️ **ونقضٌ مسجَّلٌ لـD-463** (طلبُ أحمد بلقطةٍ معلَّمة: «الجرس
 * للإشعارات · الظرف للرسائل»).
 *
 * **وحجّةُ D-463 كانت أنّ بابين لبريدٍ واحدٍ زائد** — **وهي ليست حجّةَ
 * هذا الجرس.** الذي دُمج يومَها كان **شارةً واحدةً تعني ثلاثة أشياء**
 * (D-187): رقمٌ في تبويب المجتمع لا يقول أيَّ نوعٍ منها وصل. **والجرسُ
 * اليوم يعود ومعه عدُّه وحدَه** — **رقمُ الإشعارات هنا ورقمُ الرسائل في
 * الظرف** — **فلا شارةَ غامضةٌ تعود، بل تنقسم الشارةُ الغامضةُ التي
 * بقيت** (مجموعُ D-463). **وكلُّ رقمٍ يفتح على ما يعدّه بالضبط**، وهو
 * ما كانت D-187 تطلبه أصلاً.
 *
 * **والصفحةُ لم تتغيّر**: تبويبان في `‎/messages` كما هما منذ D-463 —
 * **البابان اثنان والغرفةُ واحدة**، فلا سطحَ ثالثٌ يُبنى.
 *
 * **مكوّنُ خادمٍ بلا جافاسكربت**، والعدُّ يصل محسوباً من `Navbar` مع
 * بقيّة بيانات الترويسة — **لا نداءَ ثانٍ** (نمط D-125).
 */
export function SignalsLink({ unread, locale }: { unread: number; locale: Locale }) {
  const t = getDict(locale);
  const has = unread > 0;

  return (
    <Link
      href="/messages?tab=alerts"
      prefetch={false}
      aria-label={has ? t.notifUnreadAria(unread) : t.notifTitle}
      title={t.notifTitle}
      className="relative grid place-items-center w-10 h-10 rounded-full text-foreground/80 hover:text-foreground hover:bg-surface-2 active:scale-95 transition"
    >
      <Icon name="bell" size={20} />
      {has && (
        /* **شارةُ الظرف نفسُها شكلاً وموضعاً** — عائلةٌ واحدة لمعنًى
           واحد («عندك جديدٌ هنا»)، فلا يتعلّم القارئُ لغتين لشيءٍ واحد
           (القاعدة ٦). */
        <span
          className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-accent text-[10px] font-extrabold text-black tabular-nums"
          aria-hidden
        >
          {num(Math.min(unread, 99), locale)}
        </span>
      )}
    </Link>
  );
}
