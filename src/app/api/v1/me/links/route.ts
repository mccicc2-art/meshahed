import type { NextRequest } from "next/server";
import { deviceLinksOf, keepDevices, kodiDeviceOf, kodiPairPending, revokeLinkToken, revokePendingLegacy, setAutoMark } from "@/lib/linkTokens";
import { sharedLimited } from "@/lib/sharedLimit";
import { createClient } from "@/lib/supabase/server";
import { getMovie, getTv } from "@/lib/tmdb";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { DEVICE_KINDS, isDeviceKind, isHomeKind, kindsOf, slotLimit, usedSlots, type LinkRow } from "@/core/deviceLinks";
import { ok, type Result } from "@/core/contracts/result";
import type { DeviceLinkInfo, DeviceLinksBody, DeviceLinksState } from "@/core/contracts/deviceLinks";

/**
 * `GET /api/v1/me/links` — **مدارُ الأجهزة** لصفحة «الربط» (هجرة ٢٣٧): الطبقةُ وخاناتُها، وكلُّ جهازٍ من الخمسة مربوطٌ أم لا،
 * وأيُّها موقوفٌ بعد النزول، و«سجّل بلا سؤال». والقراءةُ نفسُها تُنزل حكمَ الخانات (`deviceLinksOf`) — فالنزولُ يظهر هنا في حينه.
 * ⚠️ **قبل الهجرة** `ready: false` بحالةٍ فارغة: التطبيقُ يعرض شاشاتِه القديمة.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:links:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    return ok(await stateOf(auth.user.id));
  });
}

async function stateOf(uid: string): Promise<DeviceLinksState> {
  const [st, device, pairing, works, last] = await Promise.all([deviceLinksOf(uid), kodiDeviceOf(uid), kodiPairPending(uid), worksBySource(uid), lastBySource(uid)]);
  if (!st) {
    return {
      tier: "free",
      limit: slotLimit("free"),
      used: 0,
      devices: DEVICE_KINDS.map((kind) => ({ kind, linked: false, stopped: false, shared: false, linked_at: null, used_at: null, works: 0 })),
      pending_legacy: null,
      auto_mark: true,
      kodi_device: null,
      kodi_pairing: false,
      ready: false,
    };
  }
  const rowFor = (kind: (typeof DEVICE_KINDS)[number]): LinkRow | undefined =>
    st.rows.find((r) => kindsOf(r).includes(kind) && (r.table !== "home_server_links" || r.server === kind)) ??
    st.rows.find((r) => kindsOf(r).includes(kind));
  const devices: DeviceLinkInfo[] = DEVICE_KINDS.map((kind) => {
    const r = rowFor(kind);
    return {
      kind,
      linked: !!r,
      stopped: !!r?.stopped_at,
      shared: !!r && r.table === "home_server_links" && !r.server,
      linked_at: r?.created_at ?? null,
      used_at: r?.last_used_at ?? null,
      works: works.get(kind) ?? 0,
      last: r ? (last.get(kind) ?? null) : null,
    };
  });
  const legacy = st.rows.find((r) => r.table === "home_server_links" && !r.server && r.kinds.length === 0);
  return {
    tier: st.tier,
    limit: Number.isFinite(st.limit) ? st.limit : null,
    used: usedSlots(st.rows),
    devices,
    pending_legacy: legacy ? { linked_at: legacy.created_at, stopped: !!legacy.stopped_at } : null,
    auto_mark: st.autoMark,
    kodi_device: devices.find((d) => d.kind === "kodi")?.linked ? device : null,
    kodi_pairing: pairing,
    ready: true,
  };
}

/**
 * 🆕 آخرُ ما وصل من كلِّ جهاز (أحمد ٥ نوفمبر «٣ ب» — سطرُ «آخر ما وصل … · The Bear S3E4» في صفحة الجهاز): أحدثُ سؤالٍ من
 * كلِّ مصدر (أُجيب أو لا) بنداءٍ واحد بجلسة العضو، واسمُ العمل من TMDB بلغته ومخبّأٌ هناك. ⚖️ مهلةُ ثانيتين ونصف لكلِّ اسم —
 * والغيابُ يُرجع السطرَ إلى الوقت وحده.
 */
async function lastBySource(uid: string): Promise<Map<string, { title: string; season: number | null; episode: number | null }>> {
  const out = new Map<string, { title: string; season: number | null; episode: number | null }>();
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("watch_signals")
      .select("source, media_type, tmdb_id, season, episode, seen_at")
      .eq("user_id", uid)
      .in("source", [...DEVICE_KINDS])
      .order("seen_at", { ascending: false })
      .limit(60);
    const first = new Map<string, { media_type: string; tmdb_id: number; season: number | null; episode: number | null }>();
    for (const r of (data ?? []) as { source: string; media_type: string; tmdb_id: number; season: number | null; episode: number | null }[]) {
      if (!first.has(r.source)) first.set(r.source, r);
    }
    const timeout = <T,>(p: Promise<T>) => Promise.race([p.catch(() => null), new Promise<null>((res) => setTimeout(() => res(null), 2500))]);
    await Promise.all(
      [...first].map(async ([src, r]) => {
        const title = r.media_type === "tv" ? (await timeout(getTv(r.tmdb_id)))?.name : (await timeout(getMovie(r.tmdb_id)))?.title;
        if (title) out.set(src, { title, season: r.media_type === "tv" ? r.season : null, episode: r.media_type === "tv" ? r.episode : null });
      }),
    );
  } catch {
    /* السطرُ بالوقت وحده */
  }
  return out;
}

/**
 * كم عملاً في مكتبة العضو سجّله كلُّ جهاز (`source` في السجلّ، D-1505) — نداءان بجلسته (RLS: صفوفُه وحدها)، والعدُّ أعمالٌ لا حلقات.
 * ⚖️ فشلُهما صمت: التأكيدُ يُقال بلا رقم.
 */
async function worksBySource(uid: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const supabase = await createClient();
    const [eps, mvs] = await Promise.all([
      supabase.from("watched_episodes").select("source, show_tmdb_id").eq("user_id", uid).in("source", [...DEVICE_KINDS]).limit(20_000),
      supabase.from("watched_movies").select("source, movie_tmdb_id").eq("user_id", uid).in("source", [...DEVICE_KINDS]).limit(20_000),
    ]);
    const seen = new Map<string, Set<string>>();
    const add = (src: string, key: string) => (seen.get(src) ?? seen.set(src, new Set()).get(src)!).add(key);
    for (const r of (eps.data ?? []) as { source: string; show_tmdb_id: number }[]) add(r.source, `tv:${r.show_tmdb_id}`);
    for (const r of (mvs.data ?? []) as { source: string; movie_tmdb_id: number }[]) add(r.source, `mv:${r.movie_tmdb_id}`);
    for (const [k, v] of seen) out.set(k, v.size);
  } catch {
    /* بلا رقم */
  }
  return out;
}

/**
 * `POST /api/v1/me/links` — «اختر ما يبقى» (`keep`) · «سجّل بلا سؤال» (`auto_mark`) · فكُّ جهاز (`revoke`) · فكُّ الرابط
 * القديم قبل أوّل إرسال (`revoke_legacy`).
 * ⚖️ الفكُّ لكلِّ أحد (اشتراكٌ انتهى يقدر على قطع جهازه)، و«اختر ما يبقى» بحدود الخانات، والإعدادُ يُحفظ لكلِّ أحد ويعمل
 * لـLoopz+ وحده (من نزل ثمّ اشترك يجده كما تركه). والحدُّ في القاعدة (A-14) لأنّ الكتابةَ تمسّ روابطَ حيّة.
 */
export async function POST(req: NextRequest) {
  return handle(async (): Promise<Result<DeviceLinksState>> => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: DeviceLinksBody;
    try {
      body = (await req.json()) as DeviceLinksBody;
    } catch {
      return fail("invalid_input");
    }
    const uid = auth.user.id;
    const rl = await sharedLimited(`links:${uid}`, 30, 60 * 60_000);
    if (rl) return rl;
    if (body?.action === "auto_mark") {
      if (typeof body.value !== "boolean") return fail("invalid_input");
      if (!(await setAutoMark(uid, body.value))) return fail("upstream");
    } else if (body?.action === "keep") {
      const kinds = Array.isArray(body.kinds) ? body.kinds.filter(isDeviceKind) : [];
      if (!kinds.length || kinds.length !== body.kinds.length) return fail("invalid_input");
      if (!(await keepDevices(uid, kinds))) return fail("conflict", { message_key: "apiLinkSlotsFull" });
    } else if (body?.action === "revoke") {
      const kind = body.kind;
      if (!isDeviceKind(kind)) return fail("invalid_input");
      const done =
        kind === "stremio"
          ? await revokeLinkToken("stremio_links", uid)
          : kind === "kodi"
            ? await revokeLinkToken("kodi_links", uid)
            : isHomeKind(kind) && (await revokeLinkToken("home_server_links", uid, kind));
      if (!done) return fail("upstream");
    } else if (body?.action === "revoke_legacy") {
      if (!(await revokePendingLegacy(uid))) return fail("upstream");
    } else {
      return fail("invalid_input");
    }
    return ok(await stateOf(uid), ["me:links", "me:stremio", "me:home-server"]);
  });
}
