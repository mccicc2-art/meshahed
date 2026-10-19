import { bodyRoute } from "@/lib/v1body";
import { syncXIdentity, unlinkXIdentity } from "@/lib/actions";

/**
 * ====== `POST /api/v1/me/profile/x` — حسابُ X من التطبيق (شريحةُ «لا ويب في التطبيق» ٣، ١٩ أكتوبر ٢٠٢٦) ======
 *
 * الربطُ نفسُه يتمّ عند Supabase من متصفّح النظام (`linkProvider("x")` في التطبيق)؛ وما بعده فعلا الويب بحرفهما:
 * `sync` يقرأ الهويّةَ ويكتب المعرّفَ والختمَ (`syncXIdentity` — الدالّةُ تعقّم بيانات الطرف الثالث)، و`unlink` يفكّ
 * الهويّةَ ثمّ يمحو الأثر (`unlinkXIdentity` — الترتيبُ فيها مقصود). الحدُّ والهويّةُ في الفعلين نفسيهما (`xlink` ١٠/دقيقة).
 */
type XBody = { action?: unknown };

export const POST = bodyRoute<XBody, { handle: string | null; error?: string }>(
  async (b) => {
    if (b.action === "unlink") {
      const r = await unlinkXIdentity();
      return { handle: null, ...(r.error ? { error: r.error } : {}) };
    }
    return syncXIdentity();
  },
  () => ["user:me:profile", "home"],
);
