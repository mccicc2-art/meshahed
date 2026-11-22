import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/data";
import { traktConfigured, traktToken, TRAKT_APP_RETURN, TRAKT_APP_STATE } from "@/lib/trakt";
import { runTraktImport } from "@/lib/traktRun";

// الاستيراد قد يكتب عشرات الآلاف من الصفوف — المهلة الافتراضية لا تكفي
export const maxDuration = 300;

/** عودة Trakt — يجلب المكتبة ويكتبها ثم يعيد المستخدم بملخّصٍ في الرابط */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/profile/settings/import?${q}`, request.url));

  /* 🆕 R281 — **رحلةُ التطبيق تعود من هنا إلى التطبيق**: Trakt لا يقبل إلّا عنوانَ https مسجّلاً (لا مخطّطَ تطبيق)، فالعنوانُ
     واحدٌ للطريقين والحالةُ تفرّقهما. نافذةُ الدخول في التطبيق بلا كوكي جلسة — فلا تُصرف الشِفرةُ هنا: تُمرَّر كما وصلت إلى
     التطبيق، وهو يرسلها مع مُتحقِّقه (PKCE) إلى `/api/v1/me/import/trakt` برمزه. شِفرةٌ بلا المُتحقِّق لا تساوي شيئاً،
     فمرورُها في عنوان التطبيق لا يكشف حساباً. */
  const appState = url.searchParams.get("state");
  if (appState?.startsWith(TRAKT_APP_STATE)) {
    const out = new URL(TRAKT_APP_RETURN);
    for (const k of ["code", "state", "error"]) {
      const v = url.searchParams.get(k);
      if (v) out.searchParams.set(k, v.slice(0, 512));
    }
    return NextResponse.redirect(out.toString());
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!traktConfigured()) return back("trakt=off");

  const store = await cookies();
  const expected = store.get("trakt_state")?.value;
  const verifier = store.get("trakt_verifier")?.value;
  store.delete("trakt_verifier");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  store.delete("trakt_state");

  // الشِفرة بلا حالةٍ مطابقة لا تُصرف — انظر تعليق البداية
  if (!code || !state || !expected || state !== expected || !verifier) return back("trakt=denied");

  const token = await traktToken(code, new URL("/api/trakt/callback", request.url).toString(), verifier);
  if (!token) return back("trakt=failed");

  const done = await runTraktImport(token, user.id, "web");
  if (!done.ok) return back("trakt=failed");
  /* 🆕 T516 — `np`: عددُ تعليقاته بلا تقييم وحدَه — النصوصُ لا تمرّ في رابط؛ الويبُ يقول العددَ وطريقَ نقلها */
  return back(`trakt=ok&sh=${done.shows}&ep=${done.episodes}&mv=${done.movies}&rv=${done.reviews}&np=${done.pending.length}&un=${done.unmatched.length}`);
}
