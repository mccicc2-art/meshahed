import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { getT } from "@/lib/locale";
import { limited } from "@/lib/v1";
import { inviterById, ownerOfCode } from "@/lib/referral";
import { welcomeSeeds } from "@/lib/welcomeSeeds";
import { posterUrl, POSTER_INTRINSIC } from "@/core/media";
import { androidOpenLink, ANDROID_TEST, appInviteLink, cleanInviteCode, playInviteLink, STORE_URL } from "@/core/storeLinks";
import { Avatar } from "@/components/Avatar";
import { AppGateSignal } from "@/components/AppGateSignal";
import { InviteCta, type InviteStep } from "./InviteCta";

/**
 * ====== 🆕 صفحةُ الدعوة — `/invite/<code>` (المهمة ٣٧٠، قرارُ أحمد ١٠ نوفمبر «1ب … نفذ أ») ======
 *
 * 🔴 **العلّة**: رابطُ الدعوة (`/join/<code>` · `/p/<code>`) كان يحفظ الكودَ في كوكي المتصفّح ويرمي الزائرَ إلى صفحة الهبوط.
 * ومن على جوّاله ينزّل التطبيقَ من المتجر ويسجّل فيه — **والمتجرُ لا يحمل شيئاً إلى التطبيق، والكوكي باقٍ في المتصفّح**. فلم
 * تُنسب دعوةُ عضوٍ سجّل من التطبيق قطّ.
 *
 * 🔑 **«افتح Loopz»** يفتح التطبيقَ بعنوانه الخاصّ حاملاً الكود (`com.loopztv.app://join/<CODE>`، يقرؤه `+native-intent.tsx`)،
 * فيسأل الترحيبُ «هل دعاك أحمد؟» قبل أن تُكتب متابعةٌ واحدة.
 * ⚖️ **لا تخمينَ بعنوان الشبكة**: Apple تمنع بصمةَ الجهاز ولو للنسبة، وiPhone لا يمرّر مصدرَ التثبيت — فمن ذهب إلى المتجر ولم
 * يرجع يجد في الترحيب «هل دعاك أحدٌ؟» بالبحث بالاسم. (ومنذ 1.14.1 يقرأ أندرويد الكودَ من مصدر التثبيت في Google Play — `playInviteLink` · `apps/mobile/src/invite/installReferrer.ts`.)
 * - **الوجهُ عامٌّ بقدر الرابط نفسِه**: من فتح الرابطَ يرى صاحبَه، ومن أخفى اسمَه لا يُعرض اسمُه ولا صورتُه.
 * - **«أكمل في المتصفح»** طريقُ الويب القائم: الكوكي كُتب في `/join` و`/p`، والنسبةُ تقع في `/auth/callback` كما كانت.
 *
 * 🆕 **المهمة ٤٢١ — التصميمُ «ب»** (ملاحظاتُ أحمد ١٨ نوفمبر على رابط الحملة، وصورُها المعتمدة):
 * - **خلفيّةٌ حيّةٌ لا سوداء** — «مثل أوّل دخولٍ في التطبيق»: جدارُ أعمال الترحيب الأربعة والعشرين يزحف خلف بطاقةٍ زجاجيّة
 *   شفّافةٍ تُرى الأعمالُ من خلفها («زيد الشفافية»)، **وملصقاتُه إنجليزيّةٌ دائماً** («خلي بوستراتها بالانجليزي»).
 * - **سطرٌ واحدٌ** تحت العنوان وثلاثُ شاراتٍ على سطرٍ واحد: «عربي · English · بلا إعلانات».
 * - **زرٌّ واحدٌ لا خطوتان** (`InviteCta`): شارةُ App Store الرسميّة على iPhone، و«انضم لتجربة أندرويد» على أندرويد، ثمّ
 *   «افتح Loopz» بعد الرجوع من المتجر.
 * - **التصميمُ واحدٌ لكلِّ دعوة**: الحملةُ تُظهر شعارَ Loopz و«انضم إلى Loopz»، ودعوةُ الصديق وجهَه واسمَه وهديّتَه — في
 *   الإطار نفسِه، لا صفحتان تفترقان.
 * - 🌗 **داكنةٌ في كلِّ ثيم**: الجدارُ صورٌ، والبطاقةُ زجاجٌ فوقها — كغلاف العمل. ألوانُها ثابتةٌ (أبيضُ على زجاجٍ داكن)
 *   **وتدرّجُ «Loopz» من ألوان الهويّة** (`--gradient-brand-x`) لا من تدرّج نصّ الثيم: ذهبيُّ `daylight` المعتَّم يُكتب
 *   على الأبيض، وهنا الخلفيّةُ داكنةٌ أبداً.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Device = "ios" | "android" | "desktop";

function deviceOf(ua: string): Device {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** «Loopz» داخل العنوان بتدرّج الهويّة — العنوانُ نصٌّ واحدٌ مترجَم، فالاسمُ يُلوَّن حيث وقع */
function withBrand(title: string) {
  const at = title.indexOf("Loopz");
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="bg-clip-text text-transparent [text-shadow:none]" style={{ backgroundImage: "var(--gradient-brand-x)" }}>
        Loopz
      </span>
      {title.slice(at + 5)}
    </>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { t, locale } = await getT();
  const code = cleanInviteCode((await params).code);
  const head = await headers();
  /* 🆕 المراجعةُ المستقلّة — حدُّ المعاينة العامّة نفسُه (`/api/v1/referral/{code}`): الصفحةُ تكشف ما تكشفه هي، فبلا حدٍّ يصير
     التخمينُ هنا بلا قيد. من تجاوزه يرى الدعوةَ بلا وجه — الأزرارُ تعمل كما هي */
  const ip = head.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const owner = code && !limited(`v1:refpreview:${ip}`, 20, 60_000) ? await ownerOfCode(code) : null;
  const inviter = owner ? await inviterById(owner.userId) : null;
  const device = deviceOf(head.get("user-agent") ?? "");
  const name = inviter?.name ?? null;
  const campaign = owner?.source === "campaign";
  const title = campaign ? t.invitePageTitleCampaign : name ? t.invitePageTitle(name) : t.invitePageTitleAnon;

  /* المراحلُ لكلِّ جهاز — «افتح Loopz» آخرُها على الجوّال وحدَه، ولا يكون بلا كود */
  const ios: InviteStep[] = [{ kind: "badge", href: STORE_URL.ios }];
  const androidPages = ANDROID_TEST.closed
    ? [
        { href: ANDROID_TEST.group, label: t.inviteAndroidJoin },
        { href: ANDROID_TEST.optIn, label: t.inviteAndroidInstall },
      ]
    : [{ href: code ? playInviteLink(code) : STORE_URL.android, label: "Google Play" }];
  /* 🆕 المهمة ٤٣٤ — على أندرويد كلُّ زرٍّ يفتح Loopz إن كان مثبّتاً وإلّا صفحتَه (`androidOpenLink`)؛ الحاسوبُ يأخذ الصفحةَ نفسَها */
  const android: InviteStep[] = androidPages.map((p) => ({
    kind: "button" as const,
    href: code && device === "android" ? androidOpenLink(code, p.href) : p.href,
    label: p.label,
  }));
  /* iPhone: عنوانُ التطبيق الخاصّ (رجع من المتجر فالتطبيقُ مثبّت)؛ أندرويد: الرابطُ نفسُه يرجع إلى صفحة التجربة إن لم يكن */
  const open: InviteStep[] = code
    ? [
        {
          kind: "button",
          href: device === "android" ? androidOpenLink(code, androidPages[0].href) : appInviteLink(code),
          label: t.inviteOpenLoopz,
        },
      ]
    : [];
  const badge = {
    badgeSrc: `/badges/app-store-${locale === "en" ? "en" : "ar"}.svg`,
    badgeAlt: t.inviteAppStoreAlt,
    copiedNote: t.inviteCopied,
    noAppLabel: t.inviteNoApp,
    newTab: device === "desktop",
  };

  return (
    /* 🆕 المهمة ٤٢٨ — **ملءُ الشاشة كلِّها لا ما تحت الشريط** (`inset-0 z-50`): الشريطان العلويُّ والسفليُّ يغيبان هنا (`isInvitePage`)،
       والشريطُ الجانبيُّ للحاسوب (`z-40`) تغطّيه الصفحة — فلا بابَ إلى التطبيق إلّا «أو أكمل في المتصفح» (أحمد: «كلها شيلها»).
       وكان `top-16` يترك على الحاسوب شريطاً أسودَ فارغاً فوق الجدار */
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#050505] text-white">
      {/* العتبةُ تُعلن نفسَها للغلاف فيخفي شريطَه (كصفحة الدخول) — الصفحةُ كلُّها بابٌ واحد */}
      <AppGateSignal />
      <Suspense fallback={null}>
        <PosterWall />
      </Suspense>
      {/* حجابٌ يعتّم الوسطَ قليلاً والأطرافَ أكثر، ووهجٌ ذهبيٌّ خفيفٌ خلف البطاقة */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(90% 55% at 50% 50%, rgba(5,5,5,.45), rgba(5,5,5,.2) 70%, rgba(5,5,5,.6))" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-[55%] blur-[10px]"
        style={{ background: "radial-gradient(circle, rgba(255,212,0,.22), transparent 65%)" }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-[26px] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* `my-auto` لا `justify-center`: البطاقةُ تتوسّط ما دامت تتّسع، وعلى شاشةٍ أقصرَ منها تُمرَّر من أعلاها لا يُقصّ رأسُها */}
        <div className="my-auto w-full max-w-[380px] rounded-sheet border border-white/10 bg-black/40 px-5 pb-[22px] pt-[26px] text-center backdrop-blur-[5px] backdrop-saturate-[1.2]">
          {campaign || !inviter ? (
            <span className="mx-auto grid size-[74px] place-items-center rounded-full border border-white/15 bg-[#141414]">
              <Image src="/loopz-mark.png" alt="Loopz" width={46} height={46} priority className="w-[46px] h-auto" />
            </span>
          ) : (
            <Avatar src={inviter.avatar_url ?? null} name={name ?? "Loopz"} size={74} alt="" className="mx-auto" />
          )}

          <h1 className="mt-3.5 text-[clamp(28px,8.6vw,36px)] font-extrabold leading-[1.2] [text-shadow:0_2px_12px_rgba(0,0,0,.7)]">
            {withBrand(title)}
          </h1>
          <p
            className={`mt-2.5 text-[clamp(13px,4vw,16px)] font-medium text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.9)] ${
              locale === "en" ? "text-balance" : "whitespace-nowrap"
            }`}
          >
            {t.invitePageLine}
          </p>

          {/* الشاراتُ الثلاث — «عربي» و«English» اسما لغتين فيُكتبان بلغتيهما في كلِّ واجهة، والثالثةُ تُترجَم */}
          <div className="mt-3.5 flex items-center justify-center gap-1.5">
            <Chip>عربي</Chip>
            <Chip latin>English</Chip>
            <Chip latin={locale === "en"}>{t.inviteChipNoAds}</Chip>
          </div>

          {owner?.source === "friend" ? (
            <p className="mt-3 text-12 font-bold leading-relaxed text-[color:var(--brand-1)] [text-shadow:0_1px_6px_rgba(0,0,0,.9)]">
              {t.invitePageGift}
            </p>
          ) : null}

          <div className="mt-[22px] flex flex-col items-center gap-3">
            {device === "ios" ? <InviteCta steps={[...ios, ...open]} code={code} {...badge} /> : null}
            {device === "android" ? <InviteCta steps={[...android, ...open]} code={code} {...badge} /> : null}
            {device === "desktop" ? (
              <>
                <InviteCta steps={ios} code={code} {...badge} />
                <div className="w-full max-w-[260px]">
                  <InviteCta steps={android.slice(0, 1)} code={code} {...badge} />
                </div>
                <p className="text-12 leading-relaxed text-white/75">{t.inviteDesktopHint}</p>
              </>
            ) : null}
          </div>

          {/* 🆕 المراجعةُ المستقلّة — عبر `/join` لا إلى `/login` مباشرةً: من وصل بنسخ رابط `/invite` لم يمرّ بباب الكوكي، و`/join`
              يكتبه ثمّ يحوّل إلى الدخول (`?to=login`) — فالنسبةُ في المتصفّح تقع في `/auth/callback` كما كانت */}
          <Link
            href={code ? `/join/${code}?to=login` : "/login"}
            prefetch={false}
            className="mt-3.5 inline-block text-[13px] text-white/80 underline underline-offset-4 transition [text-shadow:0_1px_6px_rgba(0,0,0,.9)] hover:text-white"
          >
            {t.inviteContinueWeb}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** شارةٌ زجاجيّةٌ بيضاء (الخيارُ «١») — الخطُّ اللاتينيُّ يجلس أعلى من العربيّ بدرجة، فيُسوّى خطُّ القاعدة بالحشوة لا بالارتفاع */
function Chip({ children, latin = false }: { children: React.ReactNode; latin?: boolean }) {
  return (
    <span
      className={`inline-flex h-[30px] items-center rounded-full border border-white/20 bg-white/[0.08] px-3.5 text-[13px] font-bold leading-none text-white ${
        latin ? "pt-px font-semibold" : "pt-[3px]"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * جدارُ الأعمال — **ملصقاتُ الترحيب نفسُها** (`welcomeSeeds`) بنسختها الإنجليزيّة، ستّةُ صفوفٍ مائلةٌ تزحف باتجاهين متعاكسين
 * (حلقةُ `marquee-track` في صفحة الهبوط نفسُها، وتتوقّف لمن طلب تقليلَ الحركة). زينةٌ خلف `Suspense`: البطاقةُ وزرُّها
 * يُرسمان قبل أن يصل TMDB، وسقوطُه يتركها على السواد.
 */
async function PosterWall() {
  const seeds = await welcomeSeeds({ language: "en-US" }).catch(() => []);
  const posters = seeds.map((s) => posterUrl(s.posterPath, "w185")).filter((p): p is string => !!p);
  if (posters.length < 8) return null;
  /* كلُّ صفٍّ ستّةَ عشرَ ملصقاً (أعرضُ من شاشة حاسوبٍ عريضة: ١٦ × ١٣٤ ≈ ٢١٠٠px) يبدأ من موضعٍ مختلف فلا يتجاور عملٌ ونسختُه،
     مكرّراً مرّتين: الحلقةُ تُزيح نصفَ المسار، فنصفٌ أعرضُ من الشاشة يعني دورةً بلا فراغٍ ولا قفزة */
  const rows = Array.from({ length: 6 }, (_, k) =>
    Array.from({ length: 16 }, (_, i) => posters[(k * 5 + i) % posters.length]),
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" dir="ltr" aria-hidden>
      <div className="absolute -inset-x-10 top-4 flex rotate-[-6deg] flex-col gap-2.5">
        {rows.map((row, ri) => (
          <div key={ri} className="overflow-hidden">
            <div
              className={`marquee-track${ri % 2 ? " marquee-rev" : ""}`}
              style={{ "--marquee-dur": `${80 + ri * 7}s` } as React.CSSProperties}
            >
              {[...row, ...row].map((p, i) => (
                <div
                  key={i}
                  className="relative me-2.5 aspect-[2/3] w-[clamp(72px,min(22vw,11.5vh),124px)] shrink-0 overflow-hidden rounded-poster border border-white/10 bg-[#222] shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
                >
                  <Image src={p} alt="" {...POSTER_INTRINSIC.w185} priority={ri < 3 && i < 5} className="absolute inset-0 h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
