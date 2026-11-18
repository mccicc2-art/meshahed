"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getDict, num, type Locale } from "@/core/i18n";
import type { IconName } from "@/core/iconNames";
import { setLocale, updateProfile, syncThemeCookie } from "@/lib/actions";
import { toast } from "@/lib/toast";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { FeedbackSheet } from "./FeedbackSheet";

/**
 * ====== 🆕 قشرةُ الحاسوب — الشريطُ الجانبيُّ الثابت (التصميم «أ»، أحمد ١٧ نوفمبر: «1أ») ======
 *
 * 🔑 **لماذا شريطٌ لا ترويسة**: الويبُ على الحاسوب كان تخطيطَ الجوّال ممدوداً إلى 1440 — وقائمةُ التطبيق
 * الجانبيّة (السجلّ · التقرير · التخصيص · الدعوة · اللغة · المظهر) لا بيتَ لها فيه. الشريطُ يحملها ظاهرةً دائماً،
 * ويبقى في كلِّ صفحة — **فلا صفحةَ على الحاسوب بلا تنقّل** (الملفُّ والإعداداتُ كانتا بسهم رجوعٍ وحدَه).
 * 🔑 **من 1024 فما فوق، وأيقوناتٌ فقط بين 1024 و1280** («1أ» بنصّه): ما دون 1024 يبقى كما هو، مطابقاً للتطبيق.
 * 🔑 **الظهورُ والإزاحةُ في CSS لا هنا** (`globals.css` › «قشرة الحاسوب»): الشريطُ يُرسم مخفيّاً دائماً، والقاعدةُ
 * تُظهره وتزيح الصفحةَ فقط حين يوجد (`body:has(.lz-desk)`) — **وداخل غلاف التطبيق لا يظهر أبداً** (لوحٌ عريضٌ
 * يفتح التطبيقَ يرى شريطَ التطبيق وحدَه، لا شريطين).
 * 🔑 **يُرسم فوراً بلا بيانات** (هيكلُ الحدود في `Suspense`): الروابطُ ثابتةٌ لا تنتظر الشبكة، والعدّاداتُ والاشتراكُ
 * والصورةُ تلحق حين يصل `DesktopSidebar` — **فالصفحةُ لا تقفز** حين تصل.
 * 🆕 T409 — **«الربط» حاضرٌ** مع صفحته (`/links`، الجولة ٣ من مطابقة الويب).
 */

export type SidebarData = {
  name: string;
  username: string | null;
  avatar: string | null;
  avatarPos: number;
  plus: boolean;
  planName: string;
  unreadMessages: number;
  unreadSignals: number;
  /** ما يحتاجه `updateProfile` ليحفظ الثيمَ وحدَه بلا أن يمسح غيرَه (الوصفةُ نفسُها في `ThemeSection`) */
  carry: {
    nickname: string;
    bio: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    coverPos: number;
    avatarPos: number;
    favoriteGenres: number[];
  };
  theme: string;
};

/** مساراتٌ بلا شريط: بوّابةُ الترحيب بلا مخارج (D-1341)، والوثيقتان العاريتان، والدخول */
const NO_SIDEBAR = ["/welcome", "/login", "/app/"];

/** الصفحاتُ التي تُنسب إلى «مكتبتي» — القائمةُ نفسُها في `BottomNav` (المرساةُ تضيء حيث جاء القارئ) */
const LIBRARY_PREFIXES = ["/library", "/show/", "/movie/", "/stats", "/diary", "/lists", "/ratings"];

const DAYLIGHT = "daylight";
const DEFAULT_DARK = "loopz";

export function DesktopSidebarFrame({ locale, data }: { locale: Locale; data?: SidebarData }) {
  const t = getDict(locale);
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const router = useRouter();
  const [feedback, setFeedback] = useState(false);
  const [pending, start] = useTransition();
  /* اختيارٌ متفائلٌ فوق ما جاء من الخادم: يتبدّل الرمزُ لحظةَ الضغط، ويعود إن فشل الحفظ */
  const [override, setOverride] = useState<string | null>(null);
  const theme = override ?? data?.theme ?? DEFAULT_DARK;

  /* «/» يفتح البحث من أيِّ صفحة — اختصارُ المواقع المعروف، ولا يعمل وأنت تكتب في حقل */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (window.matchMedia && !window.matchMedia("(min-width: 1024px)").matches) return;
      e.preventDefault();
      router.push("/search");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (NO_SIDEBAR.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p))) return null;

  const alerts = pathname.startsWith("/messages") && params?.get("tab") === "alerts";
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/library") return LIBRARY_PREFIXES.some((p) => pathname.startsWith(p));
    if (href === "/messages") return pathname.startsWith("/messages") && !alerts;
    if (href === "/messages?tab=alerts") return alerts;
    if (href.startsWith("/activity")) return pathname.startsWith("/activity");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isLight = theme === DAYLIGHT;

  function toggleTheme() {
    if (!data || pending) return;
    const next = isLight ? DEFAULT_DARK : DAYLIGHT;
    setOverride(next);
    start(async () => {
      try {
        await updateProfile({ ...data.carry, theme: next });
        await syncThemeCookie(next);
        router.refresh();
      } catch {
        setOverride(null);
        toast(t.errSaveShort, { tone: "error" });
      }
    });
  }

  function toggleLang() {
    if (pending) return;
    start(async () => {
      await setLocale(locale === "ar" ? "en" : "ar");
      window.location.reload();
    });
  }

  const item = (href: string, icon: IconName, label: string, opts?: { count?: number; small?: boolean; filled?: IconName }) => {
    const on = isActive(href);
    const count = opts?.count ?? 0;
    return (
      <Link
        key={href}
        href={href}
        prefetch={false}
        title={label}
        aria-label={count > 0 ? `${label} (${num(count, locale)})` : label}
        aria-current={on ? "page" : undefined}
        className={`group relative flex items-center gap-3.5 rounded-[var(--radius-control)] transition justify-center xl:justify-start mx-auto xl:mx-0 w-12 xl:w-auto ${
          opts?.small ? "h-9 xl:px-3 text-[13.5px] font-medium text-foreground/80" : "h-11 xl:h-10 xl:px-3 text-[15px] font-semibold"
        } ${on ? "bg-surface-2 text-foreground" : "hover:bg-surface hover:text-foreground"}`}
      >
        {on && <span aria-hidden className="absolute -start-2 xl:-start-3.5 top-2.5 bottom-2.5 w-[3px] rounded-full bg-accent" />}
        <span className={`relative ${on ? "text-accent" : ""}`}>
          <Icon name={on && opts?.filled ? opts.filled : icon} size={opts?.small ? 19 : 21} />
          {count > 0 && (
            <span
              aria-hidden
              className="xl:hidden absolute -top-1.5 -end-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-accent text-[10px] font-extrabold text-black tabular-nums"
            >
              {num(Math.min(count, 99), locale)}
            </span>
          )}
        </span>
        <span className="hidden xl:inline truncate">{label}</span>
        {count > 0 && (
          <span
            aria-hidden
            className="hidden xl:grid ms-auto min-w-[20px] h-5 px-1.5 place-items-center rounded-full bg-accent text-[11px] font-extrabold text-black tabular-nums"
          >
            {num(Math.min(count, 99), locale)}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      aria-label={t.drawerLabel}
      className="lz-desk fixed inset-y-0 start-0 z-40 w-[76px] xl:w-64 flex-col border-e border-border bg-[color:var(--background)] py-4 px-2 xl:px-3.5 overflow-y-auto overscroll-contain"
    >
      <Link href="/" prefetch={false} aria-label={t.brand} className="mx-auto xl:mx-0 xl:px-2 mb-3 shrink-0">
        <Logo size={40} plus={!!data?.plus} />
      </Link>

      <Link
        href="/search"
        prefetch={false}
        title={t.navSearch}
        aria-label={t.navSearch}
        aria-current={pathname.startsWith("/search") ? "page" : undefined}
        className="mx-auto xl:mx-0 mb-3 shrink-0 flex items-center gap-2.5 w-12 h-11 xl:w-auto xl:h-10 justify-center xl:justify-start xl:px-3 rounded-[var(--radius-control)] xl:border border-border xl:bg-surface text-muted hover:text-foreground hover:bg-surface transition"
      >
        <Icon name={pathname.startsWith("/search") ? "search-filled" : "search"} size={20} />
        <span className="hidden xl:inline flex-1 truncate text-[13px]">{t.navSearch}</span>
        <kbd className="hidden xl:inline text-[11px] font-medium text-muted border border-border rounded-md px-1.5 py-px" dir="ltr">
          /
        </kbd>
      </Link>

      <nav aria-label={t.navHome} className="flex flex-col gap-1">
        {item("/", "home", t.navHome, { filled: "home-filled" })}
        {item("/news", "compass", t.navNews, { filled: "compass-filled" })}
        {item("/library", "library", t.navLibrary, { filled: "library-filled" })}
        {item("/people", "people", t.navPeople, { filled: "people-filled" })}
        {item("/messages", "chat", t.communityTabInbox, { count: data?.unreadMessages })}
        {item("/messages?tab=alerts", "bell", t.notifTitle, { count: data?.unreadSignals })}
      </nav>

      <span aria-hidden className="block h-px bg-border my-2.5 mx-3 xl:mx-1" />

      <nav aria-label={t.drawerLabel} className="flex flex-col gap-0.5">
        {/* 🆕 T412 — يفتح على رقاقة «مشاهدة» كبابه في التطبيق (D-1504) */}
        {item("/activity?scope=watch", "clock", t.drawerHistory, { small: true })}
        {/* 🆕 T413 — «إحصائياتك» صفحةٌ واحدة (`/statistics`)؛ و`/reports` بابٌ يحوّل إليها */}
        {item("/statistics", "chart", t.drawerReport, { small: true })}
        {/* 🆕 T409 — «الربط» صار له بيتٌ في الويب (`/links`). الأيقونةُ «tv» لا «link»: رمزُ الرابط غيرُ موجودٍ في مجموعة الويب،
            وإضافتُه تمسّ `src/core/iconNames.ts` فتُطلق تحديثَ التطبيق — تُضاف مع بناء التطبيق القادم */}
        {item("/links", "tv", t.linksTitle, { small: true })}
        {item("/profile/settings/home", "sliders", t.drawerCustomize, { small: true })}
        {item("/profile/settings/invites", "share", t.drawerInvite, { small: true })}
      </nav>

      <div className="flex-1 min-h-4" />

      {data && (
        <Link
          href="/plus"
          prefetch={false}
          title={data.plus ? data.planName : t.drawerPlusCta}
          className="hidden xl:block [@media(max-height:820px)]:hidden mb-3 rounded-[var(--radius-card)] border border-accent/30 bg-gradient-to-br from-accent/15 to-accent/[0.02] px-3 py-2.5 hover:border-accent/60 transition"
        >
          <span className="block text-[13px] font-bold">{data.plus ? data.planName : t.drawerPlusCta}</span>
          <span className="block text-[11.5px] text-muted mt-0.5 leading-snug">
            {data.plus ? t.drawerPlusActive : t.drawerPlusFeats.join(" · ")}
          </span>
        </Link>
      )}

      <nav aria-label={t.settingsNavHeading} className="flex flex-col gap-0.5">
        {item("/profile/settings", "settings", t.drawerSettings, { small: true })}
        {item("/profile/settings/help", "comment", t.drawerHelp, { small: true })}
        <button
          type="button"
          onClick={() => setFeedback(true)}
          title={t.fbRow}
          aria-label={t.fbRow}
          className="flex items-center gap-3.5 h-9 rounded-[var(--radius-control)] justify-center xl:justify-start mx-auto xl:mx-0 w-12 xl:w-auto xl:px-3 text-[13.5px] font-medium text-foreground/80 hover:bg-surface hover:text-foreground transition"
        >
          <Icon name="send" size={19} />
          <span className="hidden xl:inline truncate">{t.fbRow}</span>
        </button>
      </nav>

      <div className="mt-2 pt-3 border-t border-border flex flex-col xl:flex-row items-center gap-2 xl:gap-2.5">
        <Link
          href="/profile"
          prefetch={false}
          title={t.drawerProfile}
          aria-label={data ? `${t.drawerProfile} — ${data.name}` : t.drawerProfile}
          className="flex items-center gap-2.5 min-w-0 xl:flex-1 rounded-full hover:opacity-80 transition"
        >
          <Avatar src={data?.avatar} name={data?.name} size={34} posY={data?.avatarPos ?? null} />
          <span className="hidden xl:block min-w-0">
            <span className="block text-[13px] font-bold truncate">{data?.name ?? ""}</span>
            {data?.username && (
              <span className="block text-[11px] text-muted truncate" dir="ltr">
                @{data.username}
              </span>
            )}
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleLang}
          disabled={pending}
          title={t.drawerLangAria(locale === "ar" ? t.arabicLang : t.englishLang)}
          aria-label={t.drawerLangAria(locale === "ar" ? t.arabicLang : t.englishLang)}
          className="hidden xl:block shrink-0 h-8 min-w-8 px-2 rounded-lg border border-border text-[11px] font-bold text-muted hover:text-foreground hover:bg-surface transition disabled:opacity-60"
          dir="ltr"
        >
          {locale === "ar" ? "EN" : "AR"}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          disabled={pending || !data}
          title={isLight ? t.drawerToDark : t.drawerToLight}
          aria-label={isLight ? t.drawerToDark : t.drawerToLight}
          className="hidden xl:grid shrink-0 place-items-center w-8 h-8 rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface transition disabled:opacity-60"
        >
          <Icon name="palette" size={16} />
        </button>
      </div>

      {feedback ? <FeedbackSheet locale={locale} onClose={() => setFeedback(false)} /> : null}
    </aside>
  );
}
