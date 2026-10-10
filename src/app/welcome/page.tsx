import { redirect } from "next/navigation";
import { getUser, getFollows, getProfile, getOnboardState } from "@/lib/data";
import { welcomeSeeds } from "@/lib/welcomeSeeds";
import { getT } from "@/lib/locale";
import { Onboarding } from "@/components/Onboarding";
import { AccountNotice } from "@/components/AccountNotice";

/**
 * الانضمام في ٦٠ ثانية.
 *
 * كان المستخدم الجديد يواجه صفحة فارغة تطلب منه عملاً قبل أن تعطيه أي قيمة.
 * هنا يبني مكتبته بضغطات، فيخرج إلى رئيسية مليئة من أول دقيقة.
 *
 * 🆕 D-1341 (Phase 11-U · U0) — **الترحيبُ بوّابةٌ لا اقتراح** (قرارُ أحمد ١٧: «الخطوات اجبارية ..
 * محد يقدر يتصفح الا اذا خلصها»): من يدخلها ومن يخرج منها يحكمه **ختمٌ مخزون** (`onboarded_at`)
 * لا استنتاجٌ من «المكتبةُ فارغة».
 */
export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const [follows, profile, state] = await Promise.all([getFollows(), getProfile(), getOnboardState()]);

  /* من أتمّ لا يعود إليها — **ولو أفرغ مكتبتَه بعدها** (كان يُرمى فيها ثانيةً).
     `unknown` (الختمُ لم يُقرأ: خطأٌ أو شيفرةٌ سبقت هجرتَها) ⇒ الحكمُ القديمُ حرفاً، لا قفل. */
  if (state === "done" || (state === "unknown" && follows.length > 0)) redirect("/");

  const seeds = await welcomeSeeds();

  return (
    /* شريطُ التطبيق لا يُرسم هنا (`hidesAppHeader`) وهو من كان يحجز حافّةَ الشاشة العليا — فتحجزها الصفحة */
    <div className="pt-[var(--safe-top)]">
      {/* 🆕 D-885: البريدُ الذي دخل به فوق أوّل خطوةٍ — **هنا بالضبط** ظنّ
          عضوٌ أنّ مكتبتَه ضاعت وهو على حساب جوجل آخر. **ولا يُرسم بلا بريد**.
          🆕 D-1341 — وهو بابُ الخروج الوحيدُ من البوّابة: «بدّل الحساب» يبقى في متناوله. */}
      {user.email ? <AccountNotice email={user.email} locale={locale} /> : null}
      <Onboarding
        locale={locale}
        userId={user.id}
        seeds={seeds}
        initialGenres={profile?.favorite_genres ?? []}
        nickname={profile?.nickname ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        username={profile?.username ?? ""}
        emptyHint={t.emptyStart}
      />
    </div>
  );
}
