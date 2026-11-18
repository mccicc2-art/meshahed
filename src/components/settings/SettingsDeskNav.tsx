"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "../Avatar";
import { Icon, type IconName } from "../Icon";
import { FeedbackSheet } from "../FeedbackSheet";
import { getDict, type Locale } from "@/core/i18n";

/**
 * 🆕 R260 — **قائمةُ أقسام الإعدادات على الحاسوب** (اختيارُ أحمد «ب»، ١٨ نوفمبر): لوحةٌ أولى ثابتةٌ بجانب القسم المفتوح،
 * فالتنقّلُ بين الأقسام ضغطةٌ واحدة بلا رجوعٍ إلى الفهرس. **البنودُ بنودُ الفهرس نفسُها وبترتيبه** (`settings/page.tsx`)
 * — قائمتان بترتيبين تُقرآن تطبيقين. على الجوّال لا تُرسم (`hidden desk:block` عند المنادي) والفهرسُ هو البابُ كما كان.
 *
 * ⚠️ «تعديل الملف» و«الربط» صفحتان خارج `/profile/settings` فتُفتحان بعرضهما الكامل — وهما كذلك في الفهرس.
 */
type Item = { href: string; icon: IconName; title: string; value?: string };

export function SettingsDeskNav({
  locale,
  name,
  username,
  avatar,
  avatarPos,
  badges,
  planName,
}: {
  locale: Locale;
  name: string;
  username: string;
  avatar: string | null;
  avatarPos: number;
  badges: ReactNode;
  planName: string;
}) {
  const t = getDict(locale);
  const pathname = usePathname() ?? "";
  const [feedback, setFeedback] = useState(false);

  const groups: { label: string; items: Item[] }[] = [
    {
      label: t.setGroupAccount,
      items: [
        { href: "/profile/edit", icon: "edit", title: t.setEditProfile },
        { href: "/profile/settings/account", icon: "person-check", title: t.setAccount },
        { href: "/profile/settings/billing", icon: "card", title: t.setBilling, value: planName },
        { href: "/profile/settings/invites", icon: "share", title: t.setInvites },
      ],
    },
    {
      label: t.setGroupPersonalize,
      items: [
        { href: "/profile/settings/home", icon: "home", title: t.setHomeProfile },
        {
          href: "/profile/settings/appearance",
          icon: "palette",
          title: t.setAppearance,
          value: locale === "en" ? t.englishLang : t.arabicLang,
        },
        { href: "/profile/settings/content", icon: "film", title: t.setContent },
      ],
    },
    {
      label: t.setGroupData,
      items: [
        { href: "/profile/settings/privacy", icon: "shield", title: t.setPrivacy },
        { href: "/profile/settings/notifications", icon: "bell", title: t.setNotifications },
        { href: "/profile/settings/import", icon: "download", title: t.setImport },
        { href: "/links", icon: "tv", title: t.linksTitle },
      ],
    },
  ];

  /* الفهرسُ على الحاسوب يعرض «المظهر واللغة» في لوحته الثانية — فبندُه هو المضاء هناك */
  const active = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (pathname === "/profile/settings" && href === "/profile/settings/appearance");

  const row = (on: boolean) =>
    `relative flex w-full items-center gap-2.5 h-10 px-3 rounded-control text-14 font-semibold transition ${
      on
        ? "bg-surface-2 text-foreground before:absolute before:-start-1.5 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-full before:bg-accent"
        : "text-muted hover:bg-surface hover:text-foreground"
    }`;

  return (
    <nav aria-label={t.settingsNavHeading} className="pb-6">
      <Link
        href={username ? `/u/${username}` : "/profile"}
        className="mb-3 flex items-center gap-3 rounded-xl bg-surface p-3 transition hover:bg-surface-2"
      >
        <Avatar src={avatar} name={name} size={44} alt="" posY={avatarPos} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center" style={{ gap: 4 }}>
            <span className="block min-w-0 truncate text-15 font-bold" dir="auto">
              {name}
            </span>
            {badges}
          </span>
          {username ? (
            <span className="block truncate text-12 font-medium text-muted" dir="ltr">
              @{username}
            </span>
          ) : null}
        </span>
      </Link>

      {groups.map((g) => (
        <div key={g.label}>
          <h2 className="px-3 pb-1.5 pt-3 text-12 font-semibold text-muted">{g.label}</h2>
          {g.items.map((it) => {
            const on = active(it.href);
            return (
              <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={row(on)}>
                <Icon name={it.icon} size={18} className={`shrink-0 ${on ? "text-accent" : ""}`} />
                <span className="min-w-0 flex-1 truncate">{it.title}</span>
                {it.value ? <span className="shrink-0 text-12 font-medium text-muted">{it.value}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}

      <h2 className="px-3 pb-1.5 pt-3 text-12 font-semibold text-muted">{t.setGroupSupport}</h2>
      {/* «أرسل مشكلة» ورقةٌ لا صفحة (D-1499) — الورقةُ نفسُها التي يفتحها صفُّ الفهرس */}
      <button type="button" onClick={() => setFeedback(true)} className={row(false)}>
        <Icon name="send" size={18} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-start">{t.fbRow}</span>
      </button>
      {[
        { href: "/profile/settings/help", icon: "comment" as IconName, title: t.setHelp },
        { href: "/profile/settings/about", icon: "info" as IconName, title: t.setAbout },
      ].map((it) => {
        const on = active(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} className={row(on)}>
            <Icon name={it.icon} size={18} className={`shrink-0 ${on ? "text-accent" : ""}`} />
            <span className="min-w-0 flex-1 truncate">{it.title}</span>
          </Link>
        );
      })}

      {/* الخروجُ وحدَه في آخر القائمة — كصفِّه المنفصل في الفهرس */}
      <form action="/auth/signout" method="post" className="mt-3 border-t border-[color:var(--divider)] pt-3">
        <button type="submit" className={`${row(false)} !text-[color:var(--error)]`}>
          <Icon name="close" size={18} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-start">{t.signOut}</span>
        </button>
      </form>

      {feedback ? <FeedbackSheet locale={locale} onClose={() => setFeedback(false)} /> : null}
    </nav>
  );
}
