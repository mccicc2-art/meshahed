import { redirect } from "next/navigation";
import { getUser, getFollows, getProfile } from "@/lib/data";
import { trending } from "@/lib/tmdb";
import { railGuard } from "@/lib/topChart";
import { getT } from "@/lib/locale";
import { Onboarding, type SeedTitle } from "@/components/Onboarding";
import { AccountNotice } from "@/components/AccountNotice";

/**
 * الانضمام في ٦٠ ثانية.
 *
 * كان المستخدم الجديد يواجه صفحة فارغة تطلب منه عملاً قبل أن تعطيه أي قيمة.
 * هنا يبني مكتبته بضغطات، فيخرج إلى رئيسية مليئة من أول دقيقة.
 */
export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const [follows, profile] = await Promise.all([getFollows(), getProfile()]);

  // من عنده مكتبة أصلاً لا يحتاج هذه الشاشة
  if (follows.length > 0) redirect("/");

  /* 🆕 **وبذورُ التهيئة تمرّ بالحارس** (D-321): **هذه الشاشةُ لا تُفتح إلا
     لمن مكتبتُه فارغة** (السطران أعلاه) — فلا شيءَ «يتابعه» بعد، **وقاعدةُ
     أحمد «لا يظهرون إلا لمن يتابعهم» تعني هنا: لا يظهرون**. وأسوأُ من
     ظهورهم أنّ الضغطةَ هنا **تكتب مكتبته**، فبذرةٌ مكتومةٌ تُختار تصير
     ذوقاً يولّد أمثالَه في «مقترح لك» إلى الأبد. */
  const popular = await trending()
    .then((rows) => railGuard(rows, { anime: "keep" }))
    .catch(() => []);
  const seeds: SeedTitle[] = popular
    .filter((r) => r.poster_path && (r.media_type === "tv" || r.media_type === "movie"))
    .slice(0, 24)
    .map((r) => ({
      id: r.id,
      mediaType: r.media_type as "tv" | "movie",
      title: r.title ?? r.name ?? "—",
      posterPath: r.poster_path,
    }));

  return (
    <>
      {/* 🆕 D-885: البريدُ الذي دخل به فوق أوّل خطوةٍ — **هنا بالضبط** ظنّ
          عضوٌ أنّ مكتبتَه ضاعت وهو على حساب جوجل آخر. يُرسم بلا شرطٍ
          لأنّ الصفحةَ نفسَها شرطُه (مكتبةٌ فارغة)، **ولا يُرسم بلا بريد**. */}
      {user.email ? <AccountNotice email={user.email} locale={locale} /> : null}
    <Onboarding
      locale={locale}
      seeds={seeds}
      initialGenres={profile?.favorite_genres ?? []}
      nickname={profile?.nickname ?? ""}
      avatarUrl={profile?.avatar_url ?? null}
      username={profile?.username ?? ""}
      emptyHint={t.emptyStart}
    />
    </>
  );
}
