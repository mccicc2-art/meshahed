import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { saveWelcomeIdentity } from "@/lib/actions";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { WelcomeIdentityBody, WelcomeIdentityPayload } from "@/core/contracts/welcome";

/**
 * `POST /api/v1/welcome/identity` — 🆕 D-1354: **اسمُ المستخدم لعضوٍ قائم** (ومعه الاسمُ والصورةُ إن عدّلهما).
 *
 * حكمُ أحمد ١١ أكتوبر: «أيّ شخص ما عنده يوزر إذا دخل اجبره يحطّ يوزر» — واختار أن تُعرض له خطوةُ «هذا أنت»
 * كاملةً. هذا بابُ حفظها **وحدَها**: لا أعمالَ تُتابَع ولا حلقاتٍ تُكتب ولا ختمَ يُمسّ (`welcome/finish` يفعل ذلك
 * كلَّه، وهو للحساب الجديد). البوّابةُ تُفتح حين يُقرأ الاسمُ في القاعدة لا حين يردّ هذا المسار.
 *
 * 🔑 **الأنواعُ المفضّلةُ تُقرأ وتُعاد كما هي**: `updateProfile` يكتب `favorite_genres` في كلِّ حفظ، وعضوٌ قائمٌ
 * اختار أنواعَه من قبل — إرسالُ قائمةٍ فارغةٍ كان سيمحوها صامتاً (سابقةُ D-546).
 * `open`: من يُحبس عند البوّابة هو بالضبط من يحتاجه.
 */
export async function POST(req: NextRequest) {
  return handle<WelcomeIdentityPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const slow = limited(`v1:welcome-identity:${auth.user.id}`, 10, 60_000);
      if (slow) return slow;
      const body = (await req.json().catch(() => null)) as WelcomeIdentityBody | null;
      if (!body || typeof body !== "object") return fail("invalid_input");
      const profile = await getProfile();
      const id = await saveWelcomeIdentity({
        nickname: String(body.nickname ?? ""),
        username: String(body.username ?? ""),
        avatarUrl: typeof body.avatarUrl === "string" && body.avatarUrl ? body.avatarUrl : null,
        favoriteGenres: profile?.favorite_genres ?? [],
      });
      if (!id.ok) return ok({ done: false, reason: id.reason });
      return ok({ done: true }, ["home", "user:me:profile"]);
    },
    { open: true },
  );
}
