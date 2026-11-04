import React, { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { ApiError } from "../api";
import { Sheet } from "../library/Sheet";
import { num } from "@/core/i18n";
import { plexHeaders, plexRecordsOf, plexServersOf, type PlexItem, type PlexServer } from "@/core/plexImport";
import { importRecords, type ImportResult } from "./importPipeline";
import { messageOf } from "./api";
import { Note } from "./ImportScreen";

/**
 * ====== 🆕 «استورد تاريخك من Plex» — ورقةُ الرمز (أحمد ٤ نوفمبر «٣ أ») ======
 *
 * 🔑 **دخولُ Plex لا يصل خادمَنا ولا يُحفظ**: الجوّالُ يطلب رمزاً من plex.tv، والعضوُ يكتبه في plex.tv/link (بلا كلمة مرور
 * عندنا)، فيعود مفتاحٌ يعيش في ذاكرة هذه الورقة وحدَها: يقرأ مكتباتِ سيرفره مرّةً ثمّ يسقط بإغلاقها.
 * **والقراءةُ من الجوّال لا من خادمنا** لأن السيرفرَ في البيت: الجوّالُ على شبكته يصله، وخادمُنا في السحابة غالباً لا.
 * ثمّ المسارُ الواحد (`importRecords`): المطابقةُ على الخادم، والكتابةُ دفعات — كملفِّ IMDb بحرفه.
 * ⚖️ **معرّفُ الجهاز ثابتٌ** (`loopz.plexClient` في SecureStore) — وإلّا أُضيف جهازٌ جديدٌ إلى حساب Plex مع كلِّ استيراد.
 */
type Phase = "start" | "code" | "reading" | "matching" | "writing" | "done";

const CLIENT_KEY = "loopz.plexClient";
const PLEX = "https://plex.tv/api/v2";
const PAGE = 500;

function clientId(): string {
  try {
    const have = SecureStore.getItem(CLIENT_KEY);
    if (have) return have;
  } catch {
    /* بلا مخزنٍ يُصنع معرّفٌ لهذه المرّة */
  }
  const id = `loopz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  SecureStore.setItemAsync(CLIENT_KEY, id).catch(() => {});
  return id;
}

/** `fetch` بمهلة — Hermes لا يحمل `AbortSignal.timeout` */
async function getJson<T>(url: string, init: { method?: string; headers: Record<string, string> }, ms = 10_000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`plex_${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type Container = { MediaContainer?: { Metadata?: PlexItem[]; Directory?: { key?: string; type?: string }[]; totalSize?: number; size?: number } };

/** أوّلُ رابطٍ يجيب من روابط السيرفر (المحلّيُّ أوّلاً) — ومهلتُه قصيرة: رابطٌ لا يُصل لا ينتظره العضو */
async function reachable(s: PlexServer, cid: string): Promise<{ uri: string; dirs: { key: string; type: string }[] } | null> {
  for (const uri of s.uris) {
    try {
      const r = await getJson<Container>(`${uri}/library/sections`, { headers: plexHeaders(cid, s.token) }, 6_000);
      const dirs = (r.MediaContainer?.Directory ?? []).filter((d) => d.key && (d.type === "movie" || d.type === "show")) as { key: string; type: string }[];
      return { uri, dirs };
    } catch {
      /* الرابطُ التالي */
    }
  }
  return null;
}

/** كلُّ عناصر نوعٍ في مكتبة — صفحاتٌ من ٥٠٠ (مكتبةُ حلقاتٍ قد تكون عشراتِ الآلاف) */
async function allOf(uri: string, s: PlexServer, cid: string, key: string, type: 1 | 2 | 4, stopped: () => boolean): Promise<PlexItem[]> {
  const out: PlexItem[] = [];
  for (let start = 0; start < 200_000; start += PAGE) {
    if (stopped()) break;
    const guids = type === 4 ? "" : "&includeGuids=1";
    const r = await getJson<Container>(
      `${uri}/library/sections/${encodeURIComponent(key)}/all?type=${type}${guids}&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${PAGE}`,
      { headers: plexHeaders(cid, s.token) },
      20_000,
    );
    const page = r.MediaContainer?.Metadata ?? [];
    out.push(...page);
    const total = r.MediaContainer?.totalSize ?? 0;
    if (!page.length || (total && start + PAGE >= total) || (!total && page.length < PAGE)) break;
  }
  return out;
}

export function PlexImportSheet({ onClose }: { onClose: () => void }) {
  const { t, tokens, locale } = useApp();
  const dict = t as unknown as Record<string, unknown>;
  const [phase, setPhase] = useState<Phase>("start");
  const [code, setCode] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const stop = useRef(false);
  /* إغلاقُ الورقة يوقف كلَّ شيء: الانتظارَ والقراءةَ والكتابة — والمفتاحُ يسقط معها */
  useEffect(() => () => void (stop.current = true), []);
  const busy = phase === "code" || phase === "reading" || phase === "matching" || phase === "writing";

  async function start() {
    stop.current = false;
    setError(null);
    setResult(null);
    haptic.pick();
    const cid = clientId();
    try {
      /* ١) الرمز — قصيرٌ (أربعة أحرف) لأن plex.tv/link يُكتب فيه بالإصبع */
      const pin = await getJson<{ id?: number; code?: string }>(`${PLEX}/pins`, { method: "POST", headers: plexHeaders(cid) });
      if (!pin.id || !pin.code) throw new Error("plex_pin");
      setCode(pin.code);
      setPhase("code");
      /* ٢) الانتظار — كلَّ ثانيتين حتى ١٥ دقيقة (عمرُ الرمز عند Plex) */
      let token: string | null = null;
      for (let i = 0; i < 450 && !stop.current; i++) {
        await new Promise((r) => setTimeout(r, 2_000));
        if (stop.current) return;
        const st = await getJson<{ authToken?: string | null }>(`${PLEX}/pins/${pin.id}`, { headers: plexHeaders(cid) }).catch(() => null);
        if (st?.authToken) {
          token = st.authToken;
          break;
        }
      }
      if (stop.current) return;
      if (!token) {
        setPhase("start");
        setError(t.plexImportExpired);
        return;
      }
      haptic.success();
      /* ٣) السيرفرات ومكتباتُها — من الجوّال */
      setPhase("reading");
      setPct(0);
      const servers = plexServersOf(await getJson<unknown>(`${PLEX}/resources?includeHttps=1&includeRelay=1`, { headers: plexHeaders(cid, token) }));
      const movies: PlexItem[] = [];
      const shows: PlexItem[] = [];
      const episodes: PlexItem[] = [];
      let reached = 0;
      for (const s of servers) {
        if (stop.current) return;
        const hit = await reachable(s, cid);
        if (!hit) continue;
        reached++;
        for (const d of hit.dirs) {
          if (stop.current) return;
          if (d.type === "movie") movies.push(...(await allOf(hit.uri, s, cid, d.key, 1, () => stop.current)));
          else {
            shows.push(...(await allOf(hit.uri, s, cid, d.key, 2, () => stop.current)));
            episodes.push(...(await allOf(hit.uri, s, cid, d.key, 4, () => stop.current)));
          }
        }
      }
      token = null; // المفتاحُ لا يُستعمل بعد هذا السطر
      if (stop.current) return;
      if (!reached) {
        setPhase("start");
        setError(t.plexImportNoServer);
        return;
      }
      const records = plexRecordsOf({ movies, shows, episodes });
      if (!records.length) {
        setPhase("start");
        setError(t.importNothing);
        return;
      }
      /* ٤) المسارُ الواحد */
      const done = await importRecords(records, { stopped: () => stop.current, phase: setPhase, pct: setPct });
      if (!done) return;
      setResult(done);
      setPhase("done");
      haptic.success();
    } catch (e) {
      if (stop.current) return;
      setPhase("start");
      setError(e instanceof ApiError ? messageOf(e, dict, t.apiInternal) : t.plexImportFailed);
    }
  }

  const label =
    phase === "reading" ? t.plexImportReading : phase === "matching" ? t.importMatching : phase === "writing" ? t.importWriting : "";

  return (
    <Sheet title={t.plexImportTitle} onClose={onClose}>
      <View style={{ gap: 12 }}>
        {phase === "code" && code ? (
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 4 }}>
            <Text size={14} muted style={{ textAlign: "center", lineHeight: 22 }}>{t.plexImportCode}</Text>
            <View style={{ borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, paddingHorizontal: 22, paddingVertical: 8 }}>
              <Text size={34} weight="700" color={tokens.accent} style={{ letterSpacing: 8, writingDirection: "ltr" }}>{code}</Text>
            </View>
            <Text size={12} muted>{t.plexImportWaiting}</Text>
            <Button label={t.plexImportOpen} variant="ghost" onPress={() => void Linking.openURL("https://plex.tv/link").catch(() => {})} style={{ alignSelf: "stretch", borderWidth: 1, borderColor: tokens.border }} />
          </View>
        ) : null}

        {phase === "start" ? (
          <>
            <Text size={13} muted style={{ lineHeight: 21 }}>{t.plexImportLead}</Text>
            <Button label={t.plexImportStart} onPress={() => void start()} />
          </>
        ) : null}

        {phase === "reading" || phase === "matching" || phase === "writing" ? (
          <View style={{ gap: 6 }}>
            <Text size={12} muted>{phase === "reading" ? label : `${label} ${num(pct, locale)}%`}</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: tokens.surface2, overflow: "hidden", flexDirection: "row" }}>
              <View style={{ width: `${phase === "reading" ? 8 : Math.max(2, pct)}%`, backgroundColor: tokens.accent }} />
            </View>
          </View>
        ) : null}

        {busy ? <Button label={t.importCancel} variant="ghost" onPress={() => void (stop.current = true, setPhase("start"))} /> : null}

        {/* سطرا الحال من شاشة الاستيراد نفسِها (`Note`) — لا صندوقٌ ثالث */}
        {error ? <Note tone="error" body={error} /> : null}
        {phase === "done" && result ? (
          <>
            <Note tone="success" title={t.importDone} body={t.importDoneBody(num(result.shows, locale), num(result.episodes, locale), num(result.movies, locale))} />
            {result.unmatched.length ? <Text size={12} muted style={{ lineHeight: 18 }}>{`${t.importUnmatchedTitle(num(result.unmatched.length, locale))}: ${result.unmatched.join(" · ")}`}</Text> : null}
          </>
        ) : null}

        <Text size={12} muted style={{ lineHeight: 18 }}>{t.plexImportPrivacy}</Text>
      </View>
    </Sheet>
  );
}
