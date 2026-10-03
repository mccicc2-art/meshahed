import { InteractionManager } from "react-native";
import { api, queryClient } from "../api";
import type { ProfilePayload } from "@/core/contracts/profile";

/**
 * ====== بياناتُ ملفّ الشخص — المفتاحُ والجلبُ في ملفٍّ صغير (🆕 D-1238) ======
 *
 * **لماذا ملفٌّ ثانٍ**: الرئيسيّةُ تسخّن ملفَّ صاحبها (أدناه)، واستيرادُ `ProfileScreen` (١٢٠٠ سطر) لأجل مفتاحٍ ودالّةِ جلبٍ
 * كان سيقيّم الشاشةَ كلَّها مع الرئيسيّة.
 */
export const profileKey = (username: string) => [`profile:${username.toLowerCase()}`] as const;

export async function fetchProfile(username: string) {
  return (await api<ProfilePayload>(`/api/v1/profile/${encodeURIComponent(username)}`)).data;
}

/**
 * 🆕 D-1238 — **ملفُّ صاحب الحساب يُجلب قبل أن يضغط صورتَه**. أرقامُ جهاز أحمد (٧ أيّام حتى ٣ أكتوبر): `profile.open`
 * وسيطُه ١٠٩٤ms من الشبكة و٤٩٠ms من الكاش — والرئيسيّةُ تعرف الاسمَ منذ رسمت رأسَها، فالانتظارُ الأوّلُ كلُّه شبكةٌ
 * كان يمكن أن تسبق الإصبع.
 * 🔑 **بعد أن تهدأ الرئيسيّة** (نهجُ `warmDiscoverOnce`): لا ينافس رسمَها ولا تسخينَ «اكتشف» والمكتبة.
 * 🔑 **يُعاد حين يغيب من الكاش لا مرّةً في الجلسة**: الكاشُ يُكنس بعد ٣٠ دقيقةً بلا مشاهد (`gcTime`)، والرئيسيّةُ تنادي
 * هذا مع كلِّ حمولةٍ جديدةٍ لها — فمن عاد بعد ساعةٍ يجد ملفَّه مسخَّناً من جديد. وما في الكاش لا يُجلب ثانيةً هنا: الشاشةُ
 * نفسُها تجدّد الشائخَ عند فتحها.
 * ⚖️ الكلفةُ طلبٌ واحدٌ حين يغيب — وفشلُه صامت (`prefetchQuery` لا يرمي)، والشاشةُ تجلب بنفسها كما كانت.
 */
let warming = false;
export function warmOwnProfile(username: string | null | undefined): void {
  if (!username || warming) return;
  const key = profileKey(username);
  if (queryClient.getQueryData(key)) return;
  warming = true;
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      warming = false;
      if (queryClient.getQueryData(key)) return;
      void queryClient.prefetchQuery({ queryKey: key, queryFn: () => fetchProfile(username), staleTime: 60_000 });
    }, 2500);
  });
}
