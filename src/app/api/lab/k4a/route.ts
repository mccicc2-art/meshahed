import { NextResponse } from "next/server";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * ====== K4a — تجربةُ الجلسة المستقلّة (Phase 11-K) — فرعٌ لا `main`، ومعاينةٌ لا إنتاج ======
 *
 * **السؤال الوحيد**: هل يسكّ الخادمُ جلسةً ثانيةً للمستخدم نفسِه (عائلةُ رمزِ تجديدٍ منفصلة) من رمزِ وصولٍ
 * صالح، فيجدّد التطبيقُ رمزَه بنفسه دون أن يصطدم بتجديد الويب (عطلُ ٧ سبتمبر، D-932)؟ جوابُه يحدّد K4b.
 *
 * 🔒 **لماذا هو آمن**: لا يعمل إلّا في معاينة Vercel من فرع `k4a/*` (وإلّا 404) · لا يأخذ مدخلاً فلا يمسّ
 * حساباً حقيقيّاً — ينشئ مستخدماً تجريبيّاً على نطاق `.invalid` (لا يُسلَّم بريدُه أبداً) ويحذفه في النهاية
 * (الحذفُ يتسلسل إلى الملفّ وكلِّ ما يتبعه) · لا رمزَ في الردّ — أطوالٌ وأجوبةُ نعم/لا وأزمنةٌ فقط ·
 * وكلُّ عمليّةٍ باسم مستخدمٍ تجري في عميلٍ جديدٍ بمفتاحٍ عامّ، لا في عميل الخدمة المفرد (لو حمل جلسةً لكتب
 * باسم صاحبها في طلباتٍ أخرى).
 */
export const dynamic = "force-dynamic";

type Step = { step: string; ok: boolean; ms: number; detail?: Record<string, unknown> };

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** عميلٌ جديدٌ لكلِّ جلسة — لا حفظ ولا تجديدٌ تلقائيّ، كما سيفعل التطبيقُ حين يملك جلسته */
function userClient(): SupabaseClient {
  return createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** معرّفُ الجلسة من داخل الرمز (`session_id`) — الدليلُ أنّ الجلستين صفّان مختلفان في `auth.sessions` */
function sid(access: string): string | null {
  try {
    const p = JSON.parse(Buffer.from(access.split(".")[1], "base64url").toString("utf8")) as { session_id?: string };
    return p.session_id ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || !(process.env.VERCEL_GIT_COMMIT_REF ?? "").startsWith("k4a/")) {
    return new NextResponse(null, { status: 404 });
  }
  const steps: Step[] = [];
  const run = async <T,>(step: string, fn: () => Promise<{ ok: boolean; value?: T; detail?: Record<string, unknown> }>): Promise<T | undefined> => {
    const t0 = Date.now();
    try {
      const r = await fn();
      steps.push({ step, ok: r.ok, ms: Date.now() - t0, detail: r.detail });
      return r.ok ? r.value : undefined;
    } catch (e) {
      steps.push({ step, ok: false, ms: Date.now() - t0, detail: { threw: e instanceof Error ? e.message : String(e) } });
      return undefined;
    }
  };

  const admin = await createServiceClient();
  const email = `k4a-${Date.now().toString(36)}@loopz.invalid`;
  let userId: string | null = null;

  /** السكُّ نفسُه كما ستفعله K4b: رابطُ دخولٍ يُولَّد في الخادم (لا بريدَ يُرسل) ثمّ يُتحقَّق منه في عميلٍ جديد */
  const mint = async (): Promise<{ ok: boolean; value?: Session; detail?: Record<string, unknown> }> => {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hash = link.data?.properties?.hashed_token;
    if (link.error || !hash) return { ok: false, detail: { generateLink: link.error?.message ?? "no hashed_token", code: link.error?.code } };
    const v = await userClient().auth.verifyOtp({ type: "magiclink", token_hash: hash });
    if (v.error || !v.data.session) return { ok: false, detail: { verifyOtp: v.error?.message ?? "no session", code: v.error?.code } };
    return { ok: true, value: v.data.session };
  };
  const refresh = async (rt: string) => {
    const r = await userClient().auth.refreshSession({ refresh_token: rt });
    return r.error || !r.data.session
      ? { ok: false, detail: { error: r.error?.message ?? "no session", code: r.error?.code } }
      : { ok: true, value: r.data.session, detail: { sameFamily: true } };
  };

  const experiment = async (): Promise<Record<string, unknown>> => {
    const created = await run("0 create test user (.invalid)", async () => {
      const r = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (r.error || !r.data.user) return { ok: false, detail: { error: r.error?.message, code: r.error?.code, hint: "service key missing in preview env ⇒ admin call fails" } };
      userId = r.data.user.id;
      return { ok: true, value: r.data.user, detail: { identities: r.data.user.identities?.map((i) => i.provider) } };
    });
    if (!created) return { verdict: "blocked" };

    /* A = جلسةُ «الويب» */
    const A = await run<Session>("1 session A (stands for the web)", mint);
    if (!A) return { verdict: "no", reason: "cannot mint even the first session" };

    /* B = جلسةُ التطبيق، مسكوكةٌ من رمز وصول A وحدَه — هو مدخلُ K4b الحقيقيّ */
    const B = await run<Session>("2 mint B from A's access token", async () => {
      const who = await admin.auth.getUser(A.access_token);
      if (who.error || who.data.user?.email !== email) return { ok: false, detail: { getUser: who.error?.message ?? "email mismatch" } };
      return mint();
    });
    if (!B) return { verdict: "no", reason: "second mint failed" };

    await run("3 A and B are separate sessions", async () => {
      const sa = sid(A.access_token);
      const sb = sid(B.access_token);
      return { ok: !!sa && !!sb && sa !== sb && A.refresh_token !== B.refresh_token, detail: { sessionIdsDiffer: sa !== sb, refreshDiffer: A.refresh_token !== B.refresh_token, bExpiresIn: B.expires_in } };
    });

    const B2 = await run<Session>("4 refresh B (the app renews itself)", () => refresh(B.refresh_token));
    const A2 = await run<Session>("5 refresh A after B rotated (web unaffected)", () => refresh(A.refresh_token));
    await run("6 B rotating again does not touch A2", async () => {
      if (!B2 || !A2) return { ok: false, detail: { skipped: true } };
      const b3 = await refresh(B2.refresh_token);
      const a = await admin.auth.getUser(A2.access_token);
      return { ok: b3.ok && !a.error, detail: { bRefresh: b3.ok, aStillValid: !a.error } };
    });

    await run("7 identities unchanged by minting", async () => {
      const u = await admin.auth.admin.getUserById(userId!);
      return { ok: !u.error, detail: { identities: u.data.user?.identities?.map((i) => i.provider), lastSignIn: !!u.data.user?.last_sign_in_at } };
    });

    /* الخروجُ: من التطبيق وحده (local) لا يُخرج الويب · ومن أيِّ جهةٍ بـglobal يُخرج الاثنين (عقدُ K4b) */
    await run("8 sign out B locally ⇒ A survives", async () => {
      const C = (await mint()).value;
      if (!C || !A2) return { ok: false, detail: { skipped: true } };
      const out = await admin.auth.admin.signOut(C.access_token, "local");
      const cAfter = await refresh(C.refresh_token);
      const aAfter = await refresh(A2.refresh_token);
      return { ok: !out.error && !cAfter.ok && aAfter.ok, detail: { signOutErr: out.error?.message ?? null, appDead: !cAfter.ok, webAlive: aAfter.ok } };
    });
    await run("9 sign out global from the web ⇒ the app is out too", async () => {
      const D = (await mint()).value;
      const W = (await mint()).value;
      if (!D || !W) return { ok: false, detail: { skipped: true } };
      const out = await admin.auth.admin.signOut(W.access_token, "global");
      const dAfter = await refresh(D.refresh_token);
      return { ok: !out.error && !dAfter.ok, detail: { signOutErr: out.error?.message ?? null, appDead: !dAfter.ok } };
    });

    const core = steps.filter((s) => /^[2-6] /.test(s.step)).every((s) => s.ok);
    return { verdict: core ? "yes" : "no" };
  };

  /* الحذفُ بعد التجربة دائماً — ويُسجَّل في الردّ نفسِه (الردُّ يُبنى بعده لا قبله) */
  let body: Record<string, unknown> = { verdict: "error" };
  try {
    body = await experiment();
  } catch (e) {
    body = { verdict: "error", threw: e instanceof Error ? e.message : String(e) };
  } finally {
    if (userId) {
      const d = await admin.auth.admin.deleteUser(userId);
      steps.push({ step: "Z delete test user", ok: !d.error, ms: 0, detail: d.error ? { error: d.error.message } : undefined });
    }
  }
  return NextResponse.json({ ...body, email, steps });
}
