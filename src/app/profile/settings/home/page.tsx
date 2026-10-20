import { redirect } from "next/navigation";
import {
  getUser,
  getProfile,
  getFollowStats,
  getProfileViewCount,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { CustomizeScreen } from "@/components/settings/CustomizeScreen";
import { isPlus } from "@/core/plan";
import { sanitizeHomePrefs } from "@/core/homePrefs";
import { sanitizeProfilePrefs } from "@/core/profilePrefs";
import { sanitizeUiState } from "@/lib/uiState";

/**
 * الرئيسيةُ والملفّ — **سطحان لا صفحتان** (D-129، ومكانُه الآن صفحتُه).
 *
 * 🆕 **والصفحةُ تجلب عدّادين رخيصين للمعاينة** (D-465): المتابِعون
 * والمتابَعون والزيارات — **وهي بالضبط الأرقامُ التي تحكمها مفاتيحُ
 * «أعلى البروفايل»**، **ومعاينةٌ تُخفي رقماً وتُظهره بلا أن تعرفه لا
 * تُعاين شيئاً.** **ولا صورةَ TMDB ولا ملخّصَ مشاهدة** — فحجّةُ D-441
 * قائمة: الغلافُ والصورةُ ملفُّك أنت، والعدّاتُ `count` لا صفوف.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale } = await getT();
  const p = await getProfile();

  const [follow, visits] = await Promise.all([
    getFollowStats(user.id),
    getProfileViewCount(user.id),
  ]);

  return (
    <CustomizeScreen
      locale={locale}
      nickname={p?.nickname ?? ""}
      avatarUrl={p?.avatar_url ?? null}
      genres={p?.favorite_genres ?? []}
      /* D-1487 — ما يُعرض هو الفعّال لخطّته، والعميلُ لا يعيد حسابَه */
      homePrefs={sanitizeHomePrefs(p?.home_prefs, isPlus(p))}
      profilePrefs={sanitizeProfilePrefs(p?.profile_prefs, isPlus(p))}
      username={p?.username ?? null}
      bio={p?.bio ?? null}
      coverUrl={p?.cover_url ?? null}
      coverPos={p?.cover_pos ?? 30}
      avatarPos={p?.avatar_pos ?? 50}
      counters={{ followers: follow.followers, following: follow.following, visits }}
      /* 🆕 **قوالبُ التخصيص** (D-822) — **من `ui_state` المقروءِ أصلاً في
         `getProfile`**: **لا نداءَ ثانٍ ولا هجرة** (D-475/D-515). */
      templates={sanitizeUiState(p?.ui_state).tpl}
      /* 🆕 D-633 — والحكمُ من `lib/plan.ts` وحدَه */
      plus={isPlus(p)}
      initialTab={tab === "profile" ? "profile" : "home"}
    />
  );
}
