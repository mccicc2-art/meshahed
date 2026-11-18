import type { ReactNode } from "react";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { planNameOf } from "@/core/plan";
import { AccountBadges } from "@/components/AccountIdentity";
import { SettingsDeskNav } from "@/components/settings/SettingsDeskNav";

/**
 * 🆕 R260 — **الإعداداتُ على الحاسوب لوحتان** (اختيارُ أحمد «ب»، ١٨ نوفمبر): قائمةُ الأقسام ثابتةٌ على الجانب، والقسمُ المفتوح
 * بجانبها — كان كلُّ قسمٍ صفحةً بعمودٍ ضيّقٍ في وسط شاشةٍ فارغة، والتنقّلُ بينها رجوعٌ إلى الفهرس ثمّ دخول.
 * **قالبٌ لا تعديلٌ في كلِّ صفحة**: الصفحاتُ كما هي، والقالبُ يضع بجانبها القائمة؛ والجوّالُ يرى الصفحةَ وحدَها حرفاً.
 * ومن لا جلسةَ له يمرّ بلا قائمة — الصفحةُ نفسُها تعيده إلى الدخول.
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) return children;
  const [{ t, locale }, profile] = await Promise.all([getT(), getProfile()]);
  const username = profile?.username ?? "";
  const name = profile?.nickname || username || (user.email ?? "").split("@")[0];

  return (
    <div className="desk:mx-auto desk:grid desk:max-w-[70rem] desk:grid-cols-[18.5rem_minmax(0,1fr)] desk:items-start desk:gap-8">
      <aside className="hidden desk:sticky desk:top-6 desk:block">
        <SettingsDeskNav
          locale={locale}
          name={name}
          username={username}
          avatar={profile?.avatar_url ?? null}
          avatarPos={profile?.avatar_pos ?? 50}
          badges={<AccountBadges profile={profile} t={t} />}
          planName={planNameOf(profile, t)}
        />
      </aside>
      <div className="lz-setpane min-w-0">{children}</div>
    </div>
  );
}
