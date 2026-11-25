import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { ToastHost, type ToastHostRef } from "../../HoldHost";
import { NETFLIX_SIGNOUT, NETFLIX_VIEWED, NetflixWeb, type NetflixWebRef, type NfxReady } from "./bridge";
import { afterOf, fetchLinks, netflixOf, readLocal, runNetflixSync, syncDue, writeLocal, type SyncOutcome, type SyncPhase } from "./sync";

/**
 * ====== 🆕 مضيفُ مزامنة نتفليكس — مرّةً فوق المكدّس (خطّة `PLAN-NETFLIX-SYNC.md`، أحمد «٢ب» و«٣ب») ======
 *
 * 🔑 **مزامنةٌ واحدةٌ في وقتٍ واحد، ومن مكانٍ واحد**: «زامن الآن» في صفحة نتفليكس، والضغطُ المطوَّل في المدار، والفتحُ بعد ستّ
 * ساعات — كلُّها تطلب هنا (`requestNetflixSync`)، وهنا متصفّحٌ مخفيٌّ واحدٌ يُركَّب للمهمّة ويُهدم بعدها.
 * - **عند فتح التطبيق** (أحمد «٢ب»): مشتركُ Loopz+ ونتفليكس مربوطةٌ شغّالة ومضت ستُّ ساعات ⇐ مزامنةٌ صامتة، ورسالةٌ قصيرةٌ إن أُضيف
 *   جديدٌ وحده («٣ب»). **ولا جدولةَ في الخلفيّة** (القرار نفسُه): الآيفون لا يضمن وقتها.
 * - **انتهاءُ الجلسة** (تحويلٌ إلى صفحة الدخول): يُعلَّم على الجهاز، ولا محاولةَ تالية حتى يعيد العضوُ الدخول بنفسه.
 * - **مهلةُ ثلاث دقائق** للمهمّة كلِّها: صفحةٌ لا تجيب لا تُبقي متصفّحاً مخفيّاً حيّاً.
 */
export type NfxJob = { kind: "auto" | "manual" | "import" } | { kind: "signout" };
export type NfxSyncState = {
  job: NfxJob | null;
  phase: SyncPhase | null;
  pct: number;
  /** آخرُ نتيجة — تقرؤها صفحةُ نتفليكس لرسالتها */
  last: { at: number; kind: NfxJob["kind"]; outcome: SyncOutcome } | null;
};

let state: NfxSyncState = { job: null, phase: null, pct: 0, last: null };
const subs = new Set<() => void>();
const set = (patch: Partial<NfxSyncState>) => {
  state = { ...state, ...patch };
  for (const f of subs) f();
};

export function useNetflixSync(): NfxSyncState {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}

/** يطلب مزامنة — يعيد `false` إن كانت أخرى جارية */
export function requestNetflixSync(kind: "auto" | "manual" | "import"): boolean {
  if (state.job) return false;
  set({ job: { kind }, phase: "reading", pct: 0 });
  return true;
}

/** يُخرج جلسةَ نتفليكس من هذا الجهاز (فكُّ الربط) — يعيد وعداً يُحلّ حين تنتهي الصفحة أو مهلتُها */
export function requestNetflixSignOut(): Promise<void> {
  return new Promise((resolve) => {
    const start = () => {
      set({ job: { kind: "signout" }, phase: null, pct: 0 });
      const unsub = (() => {
        const f = () => {
          if (!state.job) {
            subs.delete(f);
            resolve();
          }
        };
        subs.add(f);
        return () => subs.delete(f);
      })();
      setTimeout(() => {
        unsub();
        if (state.job?.kind === "signout") set({ job: null, phase: null });
        resolve();
      }, 15_000);
    };
    if (!state.job) start();
    else {
      /* مزامنةٌ جارية تُنهى أوّلاً — ثمّ الخروج */
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

export function NetflixSyncHost() {
  const { me, t } = useApp();
  const insets = useSafeAreaInsets();
  const st = useNetflixSync();
  const web = useRef<NetflixWebRef>(null);
  const toast = useRef<ToastHostRef>(null);
  const [after, setAfter] = useState<number | null | undefined>(undefined);
  const busy = useRef(false);
  const lastCheck = useRef(0);
  const uid = me?.id ?? null;
  const plus = !!me?.plus;

  /* ───── المزامنةُ الصامتة عند الفتح ───── */
  const check = useCallback(async () => {
    if (!uid || !plus || state.job) return;
    const now = Date.now();
    if (now - lastCheck.current < CHECK_GAP_MS) return;
    lastCheck.current = now;
    const d = await fetchLinks();
    const p = netflixOf(d);
    if (!syncDue(p) || readLocal(uid).expired) return;
    requestNetflixSync("auto");
  }, [uid, plus]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  /* ───── المهمّة: الحدُّ من الخادم أوّلاً، ثمّ يُركَّب المتصفّحُ المخفيّ ───── */
  const job = st.job;
  useEffect(() => {
    if (!job || job.kind === "signout") return;
    let alive = true;
    void fetchLinks().then((d) => {
      if (!alive) return;
      const p = netflixOf(d);
      if (!p || p.stopped) {
        set({ job: null, phase: null, last: { at: Date.now(), kind: job.kind, outcome: { ok: false, reason: "server" } } });
        return;
      }
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

  const finish = useCallback(
    (outcome: SyncOutcome) => {
      const kind = state.job?.kind;
      if (!kind) return;
      set({ job: null, phase: null, pct: 0, last: { at: Date.now(), kind, outcome } });
      if (kind === "auto" && outcome.ok && outcome.episodes + outcome.movies > 0) {
        toast.current?.say(t.nfxAdded(outcome.episodes, outcome.movies), undefined, undefined, "success");
      }
    },
    [t],
  );

  const onReady = useCallback(
    async (ready: NfxReady) => {
      if (!uid || busy.current || !state.job || state.job.kind === "signout" || after === undefined) return;
      busy.current = true;
      try {
        const outcome = await runNetflixSync(web.current as NetflixWebRef, ready, uid, after, {
          stopped: () => !state.job,
          phase: (phase) => set({ phase }),
          pct: (pct) => set({ pct }),
        });
        finish(outcome);
      } catch {
        finish({ ok: false, reason: "unreadable" });
      } finally {
        busy.current = false;
      }
    },
    [uid, after, finish],
  );

  const onPageState = useCallback(
    (s: string) => {
      if (!state.job) return;
      if (state.job.kind === "signout") {
        set({ job: null, phase: null });
        return;
      }
      if (s === "signed-out") {
        if (uid) writeLocal(uid, { expired: true });
        finish({ ok: false, reason: "signed-out" });
      } else if (s === "no-profile" || s === "error" || s === "gate") {
        /* 🆕 «gate»: نتفليكس تسأل «مَن يشاهد؟» بدل السجلّ — لا ملفَّ مختاراً؛ المزامنةُ الصامتة لا تختار عن العضو */
        finish({ ok: false, reason: "unreadable" });
      }
    },
    [uid, finish],
  );

  const mounted = job ? (job.kind === "signout" ? NETFLIX_SIGNOUT : after !== undefined ? NETFLIX_VIEWED : null) : null;

  return (
    <>
      {mounted ? <NetflixWeb ref={web} url={mounted} mode="hidden" onReady={(r) => void onReady(r)} onPageState={onPageState} /> : null}
      <ToastHost hostRef={toast} bottom={insets.bottom + 72} />
    </>
  );
}
