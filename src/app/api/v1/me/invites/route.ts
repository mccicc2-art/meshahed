import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getMyReferralCode, getMyInviteStats, getMyInviteList } from "@/lib/data";
import { siteUrl } from "@/lib/site";
import { isVerified } from "@/core/plan";
import type { MyInvitesPayload } from "@/core/contracts/profile";

/**
 * `GET /api/v1/me/invites` — **دعوةُ الأصدقاء** (🆕 D-1360 · Phase 11-V · V-C · C4، قرارُ أحمد ١١ أكتوبر: «نفذ»). كان صفُّ
 * «الدعوات والمكافآت» في الإعدادات الأصليّة يفتح صفحةَ الويب.
 * **الحمولةُ ما يرسمه تبويبُ «الأصدقاء» حرفاً**: الدوالُّ الثلاث نفسُها (`my_referral_code` · `my_invite_stats` · `my_invite_list`)،
 * والرابطُ جاهزٌ من `siteUrl` (D-064). قراءةٌ لصاحبها وحدَه — لا معرّفَ في الطلب.
 * 🔴 **من أخفى اسمَه يصل `person: null`**: الصفحةُ تحجب اسمَه وصورتَه ومعرّفَه في الرسم؛ والجهازُ لا يُرسل إليه ما لا يُرسم.
 * تبويبُ الشركاء ليس هنا — موقوفٌ بقرار ٨ في خطّة 11-V.
 */
export async function GET() {
  return handle<MyInvitesPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:invites:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const [code, stats, invites] = await Promise.all([getMyReferralCode(), getMyInviteStats(), getMyInviteList()]);
    return ok({
      url: code ? siteUrl(`/join/${code}`) : null,
      stats: { joined: stats.joined, qualified: stats.qualified, subscribed: stats.subscribed, reward_days: stats.rewardDays },
      items: invites.map((r) => ({
        id: r.id,
        person:
          r.person && !r.person.hide_name
            ? { nickname: r.person.nickname, username: r.person.username, avatar_url: r.person.avatar_url, verified: isVerified(r.person) }
            : null,
        joined_at: r.joinedAt,
        status: r.status,
      })),
    });
  });
}
