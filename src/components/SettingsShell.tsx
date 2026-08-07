"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon, type IconName } from "./Icon";
import { LanguageSwitch } from "./LanguageSwitch";
import { ProfileForm } from "./ProfileForm";
import { AccountSettings } from "./AccountSettings";
import { RegionSwitch } from "./RegionSwitch";
import { HomeCustomize } from "./HomeCustomize";
import { PrivacyData } from "./PrivacyData";
import { BlockedList } from "./BlockedList";
import { LibraryAccessList } from "./LibraryAccessList";
import { ImportPanel } from "./ImportPanel";
import { chipClass } from "./ui/controls";

type SectionKey =
  | "profile"
  | "account"
  | "privacy"
  | "appearance"
  | "customize"
  | "import"
  | "widgets"
  | "billing";

/**
 * صفحة الإعدادات.
 *
 * كانت الإعدادات مبعثرة على صفحتين — «تعديل الملف» و«إعدادات الحساب» —
 * وما بينهما رابطٌ صغير في الزاوية. صارت صفحةً واحدة: قائمةٌ جانبية
 * تعدّ الأقسام كلها، ولوحٌ يعرض القسم المختار.
 *
 * القسم الواحد يحمل نموذجاً واحداً لا اثنين: `ProfileForm` و
 * `AccountSettings` كلاهما يكتب في جدول `profiles` عبر `updateProfile`،
 * فلو ظهرا معاً لكتب حفظُ أحدهما قيمَ الآخر الابتدائية فوق تعديلٍ لم
 * يُحفظ. فالتقسيم هنا يتبع حدود النموذج لا الذوق وحده.
 *
 * وعلى الجوال تصير القائمة صفّاً أفقياً يُمرَّر: العمود الجانبي يأكل
 * نصف الشاشة الضيّقة.
 */
export function SettingsShell({
  userId,
  email,
  locale,
  region,
  nickname,
  bio,
  username,
  avatarUrl,
  coverUrl,
  coverPos,
  avatarPos,
  theme,
  genres,
  hideName,
  isPrivate,
  homePrefs,
  traktReady,
  initial = "profile",
}: {
  userId: string;
  email: string;
  locale: Locale;
  /** بلد المشاهدة الحالي — كوكي يقرأه الخادم، لا عمود في الحساب */
  region: string;
  /** نبذة الملف */
  bio: string | null;
  nickname: string;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  coverPos: number;
  avatarPos: number;
  theme: string;
  genres: number[];
  hideName: boolean;
  /** حسابٌ خاص — المتابعة بطلب (follow_requests.sql) */
  isPrivate: boolean;
  homePrefs?: unknown;
  /** هل مفاتيح Trakt مضبوطة على الخادم؟ الزرّ لا يُعرض بلا ذلك */
  traktReady: boolean;
  initial?: SectionKey;
}) {
  const t = getDict(locale);
  const [active, setActive] = useState<SectionKey>(initial);

  const nav: { key: SectionKey; icon: IconName; label: string }[] = [
    { key: "profile", icon: "edit", label: t.settingsNavProfile },
    { key: "account", icon: "settings", label: t.settingsNavAccount },
    { key: "privacy", icon: "shield", label: t.settingsNavPrivacy },
    { key: "appearance", icon: "palette", label: t.settingsNavAppearance },
    { key: "customize", icon: "sparkles", label: t.settingsNavCustomize },
    { key: "import", icon: "download", label: t.importSection },
    { key: "widgets", icon: "grid", label: t.settingsNavWidgets },
    { key: "billing", icon: "card", label: t.settingsNavBilling },
  ];

  const profileProps = {
    userId,
    email,
    locale,
    initialNickname: nickname,
    initialAvatarUrl: avatarUrl,
    initialCoverUrl: coverUrl,
    initialCoverPos: coverPos,
    initialAvatarPos: avatarPos,
    initialTheme: theme,
    initialGenres: genres,
    initialBio: bio,
  };
  const accountProps = {
    email,
    locale,
    initialUsername: username,
    initialNickname: nickname,
    avatarUrl,
    genres,
    initialHideName: hideName,
    initialIsPrivate: isPrivate,
  };

  function pane() {
    switch (active) {
      case "profile":
        return <ProfileForm {...profileProps} only={["cover", "avatar", "nickname", "genres"]} />;
      case "import":
        return <ImportPanel locale={locale} traktReady={traktReady} />;
      case "account":
        return <AccountSettings {...accountProps} only={["username", "displayName", "email", "signout"]} />;
      case "privacy":
        return (
          <div className="space-y-4">
            <p className="text-xs text-muted leading-relaxed">{t.settingsPrivacyHint}</p>
            <AccountSettings {...accountProps} only={["hideName", "privateAccount"]} />
            {/* استثناء «حساب خاص» الفرديّ: منحة رؤية المكتبة (D-070) */}
            <LibraryAccessList locale={locale} />
            {/* باب الرجوع الوحيد عن الحظر — الملفّ المحظور لم يعد يُفتح من دائرتك */}
            <BlockedList locale={locale} />
            <PrivacyData locale={locale} />
          </div>
        );
      case "appearance":
        return (
          <div className="space-y-4">
            <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
              <h2 className="text-sm font-bold mb-1">{t.languageSection}</h2>
              <p className="text-xs text-muted leading-relaxed mb-3">{t.languageHint}</p>
              <LanguageSwitch locale={locale} />
            </section>

            {/* بلد المشاهدة — التوفّر على المنصّات يختلف بين بلدٍ وبلد،
                وكان التطبيق يجيب عن السعودية للجميع */}
            <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
              <h2 className="text-sm font-bold mb-1">{t.regionSection}</h2>
              <p className="text-xs text-muted leading-relaxed mb-3">{t.regionHint}</p>
              <RegionSwitch locale={locale} region={region} />

              {/* النسبة إلى المصدرين.
                  شروط TMDB تُلزم بذكرها في مكانٍ ظاهر، وشروط بيانات
                  المنصّات تُلزم بنسبتها إلى JustWatch صراحةً. وكانت
                  الفقرة الأولى مكتوبةً في `AccountSettings` داخل قسمٍ
                  لا يُمرَّر إليه `language` أبداً — أي أنها لم تكن
                  تُعرض لأحد. موضعها هنا: القسم الذي يشرح فعلاً من أين
                  تأتي هذه البيانات. */}
              <div className="text-[11px] text-muted/70 mt-4 pt-3 border-t border-[color:var(--divider)] leading-relaxed space-y-1.5">
                <p>{t.tmdbAttribution}</p>
                <p>{t.justwatchAttribution}</p>
              </div>
            </section>

            <ProfileForm {...profileProps} only={["theme"]} />
          </div>
        );
      case "customize":
        return (
          <HomeCustomize
            locale={locale}
            nickname={nickname}
            avatarUrl={avatarUrl}
            genres={genres}
            initial={homePrefs}
          />
        );
      case "widgets":
        return <Soon title={t.settingsSoonTitle} body={t.settingsWidgetsHint} icon="grid" />;
      case "billing":
        return <Soon title={t.settingsSoonTitle} body={t.settingsBillingHint} icon="card" />;
    }
  }

  return (
    <div className="grid md:grid-cols-[13rem_minmax(0,1fr)] gap-4 md:gap-6">
      {/* ===== القائمة ===== */}
      {/* `min-w-0` شرطٌ لا زينة: خانة الشبكة تتّسع لمحتواها افتراضياً،
          فكان الصفّ الأفقي يمدّ الصفحة ٩٠٠ بكسل بدل أن يُمرَّر داخل نفسه */}
      <nav
        aria-label={t.settingsNavHeading}
        className="min-w-0 md:sticky md:top-20 md:self-start"
      >
        <p className="hidden md:block text-[10px] uppercase tracking-wide text-muted px-2 mb-2">
          {t.settingsNavHeading}
        </p>
        <ul className="flex md:flex-col gap-1.5 overflow-x-auto overscroll-x-contain md:overflow-visible pb-1 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
          {nav.map((n) => {
            const on = n.key === active;
            return (
              <li key={n.key} className="shrink-0 md:shrink">
                <button
                  type="button"
                  onClick={() => setActive(n.key)}
                  aria-current={on ? "page" : undefined}
                  className={chipClass(on, "md", "w-full flex items-center gap-2.5 !rounded-xl !text-[13px] !px-3 !py-2.5")}
                >
                  <Icon name={n.icon} size={16} className="shrink-0" />
                  <span className="truncate">{n.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ===== اللوح ===== */}
      <div className="min-w-0">{pane()}</div>
    </div>
  );
}

function Soon({ title, body, icon }: { title: string; body: string; icon: IconName }) {
  return (
    <section className="bg-surface border border-dashed border-border rounded-2xl p-8 text-center">
      <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-surface-2 text-muted mb-3">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="text-sm font-bold">{title}</h2>
      <p className="text-xs text-muted leading-relaxed mt-1.5 max-w-sm mx-auto">{body}</p>
    </section>
  );
}
