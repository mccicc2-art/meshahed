import { type NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { keepAppleToken, type KeepResult } from "@/lib/apple";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";

/**
 * ====== `POST /api/v1/session/apple` — ما تعطيه أبل مرّةً واحدة (🆕 D-1350 · Phase 11-U · U3 + U4) ======
 *
 * التطبيقُ يناديه مباشرةً بعد دخول أبل، برمز الجلسة الجديدة، ومعه شيئان لا تعيدهما أبل ثانيةً:
 *
 * - **`name`** — الاسمُ الذي كتبه العضوُ في ورقة أبل. ليس في رمز الهويّة، فالملفُّ يولد باسمٍ من مقطع البريد
 *   (`profile.sql`) — ومع «إخفاء بريدي» يكون ذلك حروفاً عشوائيّة. يُكتب هنا **ما دام الاسمُ هو ذاك الافتراضيّ**:
 *   من سمّى نفسَه (في الترحيب أو تعديل الملفّ) لا يُكتب فوقه. وإرشاداتُ أبل تمنع سؤالَ العضو عمّا أعطته هي.
 * - **`code`** — رمزُ التفويض؛ يُبدَّل برمز تجديدٍ يُحفظ ليُلغى به الإذنُ عند حذف الحساب (`lib/apple.ts`).
 *
 * 🔒 **الحرّاس**: صاحبُ الرمز له هويّةُ أبل فعلاً (وإلّا `forbidden`) · رمزُ أبل المُعاد يجب أن يحمل معرّفَه هو ·
 * ستُّ مرّاتٍ في الساعة · الردُّ كلمتان بلا رمزٍ ولا بريد · فشلُ أيٍّ من الشقّين لا يُفشل الآخرَ ولا الدخول.
 *
 * ⚖️ `open`: يُنادى قبل الترحيب (أوّلُ دخول) — لا يُسأل عن الختم.
 */
export const dynamic = "force-dynamic";

type Out = { named: boolean; token: KeepResult | "none" };

/** اسمٌ من ورقة أبل: مسافاتٌ مطويّة، بلا محارف تحكّم، وبطول حقل الاسم في تعديل الملفّ (٤٠) */
function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

export async function POST(req: NextRequest) {
  return handle<Out>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const rl = limited(`apple:${auth.user.id}`, 6, 60 * 60_000);
      if (rl) return rl;
      const apple = (auth.user.identities ?? []).find((i) => i.provider === "apple");
      if (!apple) return fail("forbidden");
      const body = (await req.json().catch(() => null)) as { code?: unknown; name?: unknown } | null;

      let named = false;
      const name = cleanName(body?.name);
      if (name) {
        const p = await getProfile();
        const fallback = (auth.user.email ?? "").split("@")[0];
        if (p && (!p.nickname || p.nickname === fallback)) {
          const supabase = await createClient();
          const { error } = await supabase.from("profiles").update({ nickname: name }).eq("id", auth.user.id);
          named = !error;
        }
      }

      const sub = typeof apple.identity_data?.sub === "string" ? apple.identity_data.sub : apple.id;
      const code = typeof body?.code === "string" && body.code.length > 0 && body.code.length <= 2048 ? body.code : "";
      const token: Out["token"] = code && sub ? await keepAppleToken(auth.user.id, sub, code) : "none";
      return ok({ named, token }, named ? ["user:me:profile"] : []);
    },
    { open: true },
  );
}
