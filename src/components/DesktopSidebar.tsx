import { getUser, getProfile, getUnreadSignals, getUnreadShares } from "@/lib/data";
import { getT } from "@/lib/locale";
import { isPlus, planNameOf } from "@/core/plan";
import { DEFAULT_THEME } from "@/core/themes";
import { DesktopSidebarFrame } from "./DesktopSidebarFrame";

/**
 * 🆕 قشرةُ الحاسوب — بياناتُ الشريط الجانبيّ (التصميم «أ»، أحمد ١٧ نوفمبر).
 *
 * 🔑 **لا نداءَ جديدٌ على القاعدة**: الدوالُّ الأربعُ مغلّفةٌ بـ`cache` وتناديها `Navbar` في الطلب نفسِه —
 * فالشريطُ يقرأ ما جُلب أصلاً. والزائرُ (بلا جلسة) لا شريطَ له: الهبوطُ وشريطُ الزائر كما هما.
 * 🔑 **الهيكلُ يُرسم قبل هذا** (`DesktopSidebarFrame` بلا `data` في حدود `Suspense`): الروابطُ لا تنتظر الشبكة،
 * وهذا يضيف العدّادات والاشتراكَ والصورةَ حين يصل.
 */
export async function DesktopSidebar() {
  const { locale, t } = await getT();
  const [user, profile, unreadSignals, unreadMessages] = await Promise.all([
    getUser(),
    getProfile(),
    getUnreadSignals(),
    getUnreadShares(),
  ]);
  if (!user) return null;

  return (
    <DesktopSidebarFrame
      locale={locale}
      data={{
        name: profile?.nickname || profile?.username || "",
        username: profile?.username ?? null,
        avatar: profile?.avatar_url ?? null,
        avatarPos: profile?.avatar_pos ?? 50,
        plus: isPlus(profile),
        planName: planNameOf(profile, t),
        unreadMessages,
        unreadSignals,
        carry: {
          nickname: profile?.nickname ?? "",
          bio: profile?.bio ?? "",
          avatarUrl: profile?.avatar_url ?? null,
          coverUrl: profile?.cover_url ?? null,
          coverPos: profile?.cover_pos ?? 30,
          avatarPos: profile?.avatar_pos ?? 50,
          favoriteGenres: profile?.favorite_genres ?? [],
        },
        theme: profile?.theme ?? DEFAULT_THEME.id,
      }}
    />
  );
}
