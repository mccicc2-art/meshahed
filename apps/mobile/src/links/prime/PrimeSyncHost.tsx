import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useApp } from "../../state";
import { mark } from "../../perfMarks";
import { afterOf, fetchLinks, syncDue, type SyncOutcome } from "../netflix/sync";
import type { NfxSyncState } from "../netflix/NetflixSyncHost";
import { PRIME_HOME, PrimeWeb, type PrimeWebRef } from "./bridge";
import { primeOf, readPrimeLocal, runPrimeSync, writePrimeLocal } from "./sync";

/**
 * ====== 🆕 مضيفُ مزامنة برايم فيديو — مرّةً فوق المكدّس (المهمّة ٦٠٤، أخو مضيف شاهد بحرفه) ======
 *
 * مزامنةٌ واحدةٌ في وقتٍ واحد ومن مكانٍ واحد (`requestPrimeSync`)، وصامتةٌ عند الفتح إن مضت المدّة (`syncDue`)، ومهلةُ ثلاث دقائق.
 * الصفحةُ المخفيّةُ رئيسيّةُ برايم، ثمّ تُطلب صفحاتُه بجلستها (`page`).
 * - لا جلسة ⇐ «انتهت الجلسة» على الجهاز، ولا محاولةَ تالية حتى يعيد العضوُ الدخول.
 * - صفحةُ «من يشاهد؟» ⇐ «اختر ملفك من جديد» — المزامنةُ الصامتة لا تختار عن العضو.
 * - الخروجُ عند الفكّ: تُمسح كوكياتُ الصفحة التي يصلها سكربت.
 */
export type PrimeJob = NfxSyncState["job"];

let state: NfxSyncState = { job: null, phase: null, pct: 0, last: null };
const subs = new Set<() => void>();
const set = (patch: Partial<NfxSyncState>) => {
  state = { ...state, ...patch };
  for (const f of subs) f();
};

export function usePrimeSync(): NfxSyncState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

export function requestPrimeSync(kind: "auto" | "manual" | "import"): boolean {
  if (state.job) return false;
  set({ job: { kind }, phase: "reading", pct: 0 });
  return true;
}

/** يمسح جلسةَ برايم من متصفّح هذا الجهاز (فكُّ الربط) — يُحلّ حين تنتهي الصفحة أو مهلتُها */
export function requestPrimeSignOut(): Promise<void> {
  return new Promise((resolve) => {
    const start = () => {
      set({ job: { kind: "signout" }, phase: null, pct: 0 });
      const f = () => {
        if (!state.job) {
          subs.delete(f);
          resolve();
        }
      };
      subs.add(f);
      setTimeout(() => {
        subs.delete(f);
        if (state.job?.kind === "signout") set({ job: null, phase: null });
        resolve();
      }, 15_000);
    };
    if (!state.job) start();
    else {
      const f = () => {
        if (!state.job) {
          subs.delete(f);
          start();
        }
      };
      subs.add(f);
    }
  });
}

const JOB_MS = 3 * 60_000;
const CHECK_GAP_MS = 10 * 60_000;

export function PrimeSyncHost() {
  const { me } = useApp();
  const st = usePrimeSync();
  const web = useRef<PrimeWebRef>(null);
  const [after, setAfter] = useState<number | null | undefined>(undefined);
  /* 🆕 T579 — «إضافة مشاهداتي تلقائياً» مطفأ ⇒ هذه المزامنةُ تسأل ولا تكتب (يُقرأ مع حدِّها من الخادم) */
  const ask = useRef(false);
  const busy = useRef(false);
  const lastCheck = useRef(0);
  const startedAt = useRef(0);
  const uid = me?.id ?? null;

  const check = useCallback(async () => {
    if (!uid || state.job) return;
    const now = Date.now();
    if (now - lastCheck.current < CHECK_GAP_MS) return;
    lastCheck.current = now;
    const p = primeOf(await fetchLinks());
    const loc = readPrimeLocal(uid);
    if (!syncDue(p) || loc.expired || loc.profile) return;
    requestPrimeSync("auto");
  }, [uid]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  const finish = useCallback(
    (outcome: SyncOutcome) => {
      const kind = state.job?.kind;
      if (!kind) return;
      if (kind !== "signout") {
        const s = outcome.ok ? outcome.stats : undefined;
        /* قياسُ نتفليكس نفسُه بنوعٍ يسبقه `prime:` — لا اسمَ جديدَ في قائمة الخادم */
        mark("nfx.sync", Math.max(0, Date.now() - startedAt.current), {
          /* 🆕 المهمّة ٥٦٨ — نقطةٌ لا نقطتان: القياسُ يقبل `[\w.-]` وحدها، فكان النوعُ بنقطتين يسقط من الصفّ بصمت */
          kind: `prime.${kind}`,
          result: outcome.ok ? "ok" : outcome.reason,
          /* 🆕 المهمّة ٥٧١ — لماذا لم تُقرأ: ردُّ برايم أو انتقالُ الصفحة أو المهلة (قياسُ أحمد بعد R319: `unreadable` بلا سبب) */
          ...(!outcome.ok && outcome.reason === "unreadable" ? { why: web.current?.why() || "job" } : {}),
          ...(outcome.ok ? { ep: outcome.episodes, mv: outcome.movies } : {}),
          ...(s ? { items: s.items, rec: s.rec, part: s.part, skip: s.skip, unm: s.unm } : {}),
        });
      }
      set({ job: null, phase: null, pct: 0, last: { at: Date.now(), kind, outcome } });
      /* 🆕 المهمّة ٥٦١ — لا شريطَ لمزامنة الفتح: الخادمُ يرسل إشعارَ الجوال ويكتب سطرَ الجرس (أحمد «٢ب»: الاثنان في الثانية نفسِها تكرار) */
    },
    [],
  );

  const job = st.job;
  useEffect(() => {
    if (!job || job.kind === "signout") return;
    startedAt.current = Date.now();
    let alive = true;
    void fetchLinks().then((d) => {
      if (!alive) return;
      const p = primeOf(d);
      if (!p || p.stopped) {
        set({ job: null, phase: null, last: { at: Date.now(), kind: job.kind, outcome: { ok: false, reason: "server" } } });
        return;
      }
      ask.current = p.auto_add === false;
      setAfter(afterOf(p));
    });
    const timer = setTimeout(() => finish({ ok: false, reason: "unreadable" }), JOB_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
      setAfter(undefined);
      busy.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  const onReady = useCallback(async () => {
    if (!uid || busy.current || !state.job || after === undefined) return;
    if (state.job.kind === "signout") {
      setTimeout(() => set({ job: null, phase: null }), 300);
      return;
    }
    busy.current = true;
    try {
      const outcome = await runPrimeSync(web.current as PrimeWebRef, uid, after, {
        auto: state.job?.kind === "auto",
        ask: ask.current,
        stopped: () => !state.job,
        phase: (phase) => set({ phase }),
        pct: (pct) => set({ pct }),
      });
      if (!outcome.ok && outcome.reason === "signed-out") writePrimeLocal(uid, { expired: true });
      finish(outcome);
    } catch {
      finish({ ok: false, reason: "unreadable" });
    } finally {
      busy.current = false;
    }
  }, [uid, after, finish]);

  const onPageState = useCallback(
    (s: string) => {
      if (!state.job) return;
      if (state.job.kind === "signout") {
        set({ job: null, phase: null });
        return;
      }
      if (s === "signed-out") {
        if (uid) writePrimeLocal(uid, { expired: true });
        finish({ ok: false, reason: "signed-out" });
      } else if (s === "gate") {
        if (uid) writePrimeLocal(uid, { profile: true });
        finish({ ok: false, reason: "profile" });
      }
    },
    [uid, finish],
  );

  const mounted = job ? (job.kind === "signout" || after !== undefined ? PRIME_HOME : null) : null;

  return (
    <>
      {mounted ? <PrimeWeb ref={web} url={mounted} mode="hidden" onReady={() => void onReady()} onPageState={onPageState} signOut={job?.kind === "signout"} /> : null}
    </>
  );
}
