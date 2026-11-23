import { headers } from "next/headers";
import { InviteCta, type InviteStep } from "@/app/invite/[code]/InviteCta";
import { ANDROID_TEST, STORE_URL } from "@/core/storeLinks";
import { getDict, type Locale } from "@/core/i18n";

/**
 * ====== 🆕 T530 — «حمّل لوبز» لزائر صفحة المراجعة (أحمد ٢٣ نوفمبر «٢أ») ======
 *
 * من وصل من X إلى مراجعةٍ بلا حسابٍ يجد تحتها بابَ التطبيق. **الزرُّ زرُّ صفحة الدعوة نفسُه** (`InviteCta`) بمراحله لكلِّ جهاز:
 * شارةُ App Store الرسميّة على الآيفون، و«انضم لتجربة أندرويد» ثمّ «فعّل التجربة» على أندرويد ما دام الاختبارُ مغلقاً، والاثنان
 * معاً على الحاسوب. **بلا كود دعوة** — فلا نسخَ إلى الحافظة ولا «افتح Loopz».
 */
export async function DownloadLoopzBar({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
  const ios: InviteStep[] = [{ kind: "badge", href: STORE_URL.ios }];
  const android: InviteStep[] = (
    ANDROID_TEST.closed
      ? [
          { href: ANDROID_TEST.group, label: t.inviteAndroidJoin },
          { href: ANDROID_TEST.optIn, label: t.inviteAndroidInstall },
        ]
      : [{ href: STORE_URL.android, label: "Google Play" }]
  ).map((p) => ({ kind: "button" as const, href: p.href, label: p.label }));
  const badge = {
    code: "",
    badgeSrc: `/badges/app-store-${locale === "en" ? "en" : "ar"}.svg`,
    badgeAlt: t.inviteAppStoreAlt,
    copiedNote: t.inviteCopied,
    noAppLabel: t.inviteNoApp,
  };
  return (
    /* لوحٌ داكنٌ في الثيمين كبطل صفحة الدعوة: `InviteCta` مرسومٌ لخلفيّةٍ داكنة (سطرُ «ما عندك التطبيق؟» أبيضُ بظلّ) — وعلى
       سطح «النهاري» كان يختفي (مراجعةُ الوكيل ٢، البند ٦) */
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#0A0A0A] p-4 text-center text-white">
      <p className="text-15 font-bold">{t.reviewGetLoopz}</p>
      <p className="mt-1 text-12 text-white/70">{t.reviewGetLoopzSub}</p>
      <div className="mt-3 flex flex-col items-center gap-3">
        {device === "ios" ? <InviteCta steps={ios} {...badge} /> : null}
        {device === "android" ? <InviteCta steps={android} {...badge} /> : null}
        {device === "desktop" ? (
          <>
            <InviteCta steps={ios} {...badge} newTab />
            <div className="w-full max-w-[260px]">
              <InviteCta steps={android.slice(0, 1)} {...badge} newTab />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
