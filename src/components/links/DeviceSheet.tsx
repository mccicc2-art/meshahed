"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { buttonClass } from "../ui/Button";
import { sheetScroll } from "../ui/controls";
import { Sheet, SheetHeader } from "../ui/Sheet";
import { v1Post } from "../InboxComposer";
import { DeviceMark } from "./DeviceMark";
import { canLinkNow, deviceName, episodeLabel, linkedNames, linksWrite } from "./linksApi";
import { copiedToast, flashError, toast } from "@/lib/toast";
import { timeAgo } from "@/core/when";
import { JELLYFIN_TEMPLATE } from "@/core/homeServer";
import type { Dict } from "@/core/i18n";
import type { HomeServerLinkResult, KodiResult } from "@/core/contracts/homeServer";
import type { StremioLinkResult } from "@/core/contracts/stremio";
import type { AddonClient } from "@/core/stremioId";
import type { DeviceKind, DeviceLinksState, HomeKind } from "@/core/contracts/deviceLinks";

/**
 * ====== 🆕 صفحةُ الجهاز في الويب — ورقةٌ فوق «الربط» (التصميم «أ»، أحمد ١٨ نوفمبر) ======
 *
 * المحتوى والمنطقُ منطقُ `apps/mobile/src/links/DeviceScreens.tsx` بحرفه، والأبوابُ نفسُها:
 * - **Plex · Jellyfin · Emby:** `POST me/home-server/link {issue, server}` → رابطٌ يظهر **مرّةً واحدة** داخل خطوة «الصق رابطك».
 * - **Kodi:** رمزُ ستّة أرقام (`me/home-server/kodi {code}`) يُطلب حين تُفتح الورقةُ لمن له خانة، والصفحةُ تسأل كلَّ ٣ ثوانٍ حتى يصل.
 * - **Stremio:** الإضافةُ تُثبَّت (`me/stremio/link {issue}`) — زرُّ «ثبّت» يفتح Stremio، و«ثبّت في Stremio Web» لمن لا يملكه.
 * - لا خانة: «خانتك ممتلئة» باسم المربوط و«اعرف أكثر» إلى `/plus`. والفكُّ يُؤكَّد بجملة التطبيق نفسِها.
 * 🔑 ورقةٌ لا صفحة: الزائرُ يبقى يرى مدارَه خلفها، والورقةُ تُغلق على «الربط» لا على صفحةٍ ثالثة.
 */
export function DeviceSheet({
  kind,
  d,
  t,
  onState,
  onReload,
  onClose,
}: {
  kind: DeviceKind;
  d: DeviceLinksState;
  t: Dict;
  onState: (s: DeviceLinksState) => void;
  onReload: () => Promise<unknown>;
  onClose: () => void;
}) {
  const name = deviceName(kind);
  const [confirm, setConfirm] = useState(false);
  const info = d.devices.find((x) => x.kind === kind);

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} variant="bottom" labelledBy="device-sheet-title" className="flex flex-col">
      <SheetHeader id="device-sheet-title" title={confirm ? t.linksUnlink : name} closeLabel={t.closeLabel} onClose={onClose} />
      <div className={sheetScroll}>
        {confirm ? (
          <UnlinkBody kind={kind} works={info?.works ?? 0} t={t} onState={onState} onDone={onClose} onBack={() => setConfirm(false)} />
        ) : kind === "stremio" || kind === "nuvio" ? (
          <StremioBody client={kind} d={d} t={t} onReload={onReload} onUnlink={() => setConfirm(true)} />
        ) : kind === "kodi" ? (
          <KodiBody d={d} t={t} onReload={onReload} onUnlink={() => setConfirm(true)} />
        ) : (
          <HomeBody kind={kind} d={d} t={t} onReload={onReload} onUnlink={() => setConfirm(true)} />
        )}
      </div>
    </Sheet>
  );
}

/* ───────── الرأس: الشارةُ والاسمُ و«مجاناً» والحالُ وآخرُ ما وصل وسطرا الشرح ───────── */
function Head({ kind, d, t, intro, needs }: { kind: DeviceKind; d: DeviceLinksState; t: Dict; intro: string; needs?: string }) {
  const info = d.devices.find((x) => x.kind === kind);
  const on = !!info?.linked && !info.stopped;
  const waiting = on && !info?.used_at;
  const status = info?.stopped ? t.linksStopped : waiting ? t.deviceWaitingPill : on ? t.stremioLinked : t.stremioNotLinked;
  const tone = on && !waiting ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : waiting ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted";
  const last =
    on && info?.used_at
      ? info.last
        ? `${t.homeServerLastSeen(timeAgo(info.used_at, t))} · ${info.last.title}${episodeLabel(info.last) ? ` ${episodeLabel(info.last)}` : ""}`
        : t.homeServerLastSeen(timeAgo(info.used_at, t))
      : null;
  return (
    <div className="flex flex-col items-center gap-2 px-5 pt-5 text-center">
      <DeviceMark kind={kind} size={72} state={waiting ? "waiting" : on ? "on" : info?.stopped ? "paused" : "idle"} />
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold" dir="ltr">
          {deviceName(kind)}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-12 font-bold text-muted">{t.linksFreeTag}</span>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-12 font-bold ${tone}`}>{status}</span>
      {waiting && <p className="text-sm text-muted leading-relaxed">{t.deviceWaitHint(kind)}</p>}
      {last && <p className="text-sm text-muted leading-relaxed">{last}</p>}
      <p className="mt-1 text-sm leading-relaxed">{intro}</p>
      {needs && <p className="text-12 text-muted leading-relaxed">{needs}</p>}
    </div>
  );
}

function FullCard({ d, t }: { d: DeviceLinksState; t: Dict }) {
  return (
    <div className="mx-5 mt-4 rounded-2xl border border-accent/35 bg-accent/10 p-4">
      <p className="text-15 font-bold">{t.linksSlotFull}</p>
      <p className="mt-1 text-sm text-muted leading-relaxed">{t.deviceFullSub(linkedNames(d)[0] ?? "")}</p>
      <Link href="/plus" className={buttonClass({ size: "sm", className: "mt-3" })}>
        {t.linksLearnMore}
      </Link>
    </div>
  );
}

function Steps({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-5 mt-4 rounded-2xl border border-border bg-surface">
      <p className="px-4 pt-3 text-12 font-bold text-muted">{title}</p>
      {children}
    </div>
  );
}

function Step({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-accent/15 text-12 font-extrabold text-accent">{n}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-relaxed">{text}</p>
        {children}
      </div>
    </div>
  );
}

/** صندوقُ الرابط أو الرمز — إطارٌ متقطّعٌ بلون التمييز (كـ`Slab` في التطبيق) */
function Slab({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 rounded-[var(--radius-control)] border border-dashed border-accent/50 bg-accent/5 p-3">{children}</div>;
}

function RowBtn({ icon, title, sub, danger, busy, onClick }: { icon: "repeat" | "trash" | "copy" | "list"; title: string; sub?: string; danger?: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-surface-2 disabled:opacity-60 ${danger ? "text-[color:var(--error)]" : ""}`}
    >
      <Icon name={icon} size={19} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {sub && <span className="block text-12 text-muted">{sub}</span>}
      </span>
    </button>
  );
}

function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mx-5 mt-4">
      {label && <p className="mb-1.5 px-1 text-12 font-bold text-muted">{label}</p>}
      <div className="divide-y divide-[color:var(--divider)] overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
    </div>
  );
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedToast(done);
  } catch {
    /* الحافظةُ مرفوضة — الرابطُ ظاهرٌ يُنسخ باليد */
  }
}

const errOf = (e: unknown) => flashError(e instanceof Error ? e.message : String(e));

/* ============================================================ Plex · Jellyfin · Emby */
function HomeBody({ kind, d, t, onReload, onUnlink }: { kind: HomeKind; d: DeviceLinksState; t: Dict; onReload: () => Promise<unknown>; onUnlink: () => void }) {
  const name = deviceName(kind);
  const info = d.devices.find((x) => x.kind === kind);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    setBusy(true);
    try {
      const r = await v1Post<HomeServerLinkResult>("/api/v1/me/home-server/link", { action: "issue", server: kind }, t);
      setFresh(r.webhook_url ?? null);
      void onReload();
    } catch (e) {
      errOf(e);
    } finally {
      setBusy(false);
    }
  };
  const linked = !!info?.linked || !!fresh;
  const can = canLinkNow(d, kind);
  const steps = kind === "plex" ? t.homeServerStepsPlex : kind === "jellyfin" ? t.homeServerStepsJellyfin : t.homeServerStepsEmby;
  const needs = kind === "plex" ? t.devicePlexNeeds : kind === "jellyfin" ? t.deviceJellyfinNeeds : t.deviceEmbyNeeds;
  const slab = fresh ? (
    <Slab>
      <p className="break-all text-sm font-bold text-accent select-all" dir="ltr">
        {fresh}
      </p>
      <button type="button" className={buttonClass({ size: "sm" })} onClick={() => void copy(fresh, t.stremioCopied)}>
        <Icon name="copy" size={15} />
        {t.homeServerCopy}
      </button>
      <p className="text-12 text-muted">{t.stremioLinkOnce}</p>
    </Slab>
  ) : linked ? (
    <Slab>
      <p className="text-sm font-bold text-accent" dir="ltr">
        loopztv.com/api/v1/home-server/lh_•••
      </p>
      <p className="text-12 text-muted">{t.homeServerLink}</p>
    </Slab>
  ) : can ? (
    <button type="button" disabled={busy} className={buttonClass({ size: "md" })} onClick={() => void issue()}>
      {t.homeServerCreate}
    </button>
  ) : null;
  return (
    <div className="pb-5">
      <Head kind={kind} d={d} t={t} intro={t.deviceHomeIntro(name)} needs={needs} />
      {!linked && !can && <FullCard d={d} t={t} />}
      <Steps title={t.deviceSteps}>
        {steps.map((line, i) => (
          <Step key={line} n={i + 1} text={line}>
            {i === 1 ? slab : null}
          </Step>
        ))}
      </Steps>
      {kind === "jellyfin" && (
        <Group>
          <RowBtn icon="copy" title={t.homeServerCopyTemplate} sub={t.homeServerTemplateSub} onClick={() => void copy(JELLYFIN_TEMPLATE, t.homeServerTemplateCopied)} />
        </Group>
      )}
      {linked && (
        <>
          <Group label={t.deviceLink}>
            {info?.shared ? null : <RowBtn icon="repeat" title={t.stremioNewLink} sub={t.stremioNewLinkSub} busy={busy} onClick={() => void issue()} />}
            <RowBtn icon="trash" title={t.stremioRevoke} danger onClick={onUnlink} />
          </Group>
          <p className="mx-6 mt-2 text-12 text-muted leading-relaxed">{info?.shared ? t.deviceSharedNote : t.deviceOwnLink(name)}</p>
        </>
      )}
    </div>
  );
}

/* ============================================================ Kodi */
function KodiBody({ d, t, onReload, onUnlink }: { d: DeviceLinksState; t: Dict; onReload: () => Promise<unknown>; onUnlink: () => void }) {
  const info = d.devices.find((x) => x.kind === "kodi");
  /* `base`: ربطُ Kodi كما كان حين صدر الرمز — الربطُ الجديدُ يُعرف بتغيُّره (منطقُ التطبيق بحرفه) */
  const [code, setCode] = useState<{ code: string; expires_at: string; base: string | null } | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  /* الرمزُ يذهب وحده حين يتبدّل الربط (وصل من Kodi) — قيمةٌ مشتقّةٌ لا حالةٌ تُمسح في أثر */
  const linkedAt = info?.linked ? info.linked_at : null;
  const done = !!code && !!linkedAt && linkedAt !== code.base;
  const live = done ? null : code;
  const waiting = !!live && !expired;
  const newCode = async () => {
    setBusy(true);
    try {
      const r = await v1Post<KodiResult>("/api/v1/me/home-server/kodi", { action: "code" }, t);
      if (r.code && r.expires_at) {
        setCode({ code: r.code, expires_at: r.expires_at, base: info?.linked ? info.linked_at : null });
        setExpired(false);
      }
    } catch (e) {
      errOf(e);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => void onReload(), 3000);
    return () => clearInterval(id);
  }, [waiting, onReload]);
  const can = canLinkNow(d, "kodi");
  const ask = d.ready && can && !info?.linked && !live;
  const asked = useRef(false);
  useEffect(() => {
    if (!ask || asked.current) return;
    asked.current = true;
    void newCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرّةً لكلِّ فتح، والدالّةُ تتغيّر مع كلِّ رسم
  }, [ask]);
  useEffect(() => {
    if (!code) return;
    const id = setTimeout(() => setExpired(true), Math.max(0, Date.parse(code.expires_at) - Date.now()));
    return () => clearTimeout(id);
  }, [code]);
  useEffect(() => {
    if (done) toast(t.kodiLinkedToast);
  }, [done, t.kodiLinkedToast]);
  const linked = !!info?.linked;
  const codeBox =
    live || (!linked && can) ? (
      <Slab>
        <p className={`text-center text-4xl font-extrabold tracking-[0.3em] tabular-nums ${live && !expired ? "text-accent" : "text-muted"}`} dir="ltr">
          {live ? `${live.code.slice(0, 3)} ${live.code.slice(3)}` : "––– –––"}
        </p>
        <p className="text-center text-12 text-muted">{expired ? t.kodiCodeExpired : t.kodiCodeWait}</p>
        {expired && (
          <button type="button" disabled={busy} className={buttonClass({ size: "sm", full: true })} onClick={() => void newCode()}>
            {t.kodiNewCode}
          </button>
        )}
      </Slab>
    ) : null;
  return (
    <div className="pb-5">
      <Head kind="kodi" d={d} t={t} intro={t.deviceKodiIntro} needs={t.deviceKodiNeeds} />
      {linked && d.kodi_device && (
        <p className="mt-1 text-center text-sm text-muted">{t.kodiLinkedFrom(d.kodi_device, info?.used_at ? timeAgo(info.used_at, t) : null)}</p>
      )}
      {!linked && !can && <FullCard d={d} t={t} />}
      <Steps title={t.deviceSteps}>
        {t.homeServerStepsKodi.map((line, i) => (
          <Step key={line} n={i + 1} text={line}>
            {i === t.homeServerStepsKodi.length - 1 ? codeBox : null}
          </Step>
        ))}
      </Steps>
      {!linked && can && <p className="mx-6 mt-2 text-12 text-muted leading-relaxed">{t.deviceKodiLinkedNote}</p>}
      {linked && (
        <Group label={t.deviceLink}>
          {live ? null : <RowBtn icon="repeat" title={t.kodiNewCode} sub={t.kodiNewCodeSub} busy={busy} onClick={() => void newCode()} />}
          <RowBtn icon="trash" title={t.kodiRevoke} danger onClick={onUnlink} />
        </Group>
      )}
    </div>
  );
}

/* ============================================================ Stremio و🆕 Nuvio — الإضافةُ نفسُها، ولكلٍّ رابطُه وخانتُه (هجرة ٢٦٧) */
function StremioBody({ client, d, t, onReload, onUnlink }: { client: AddonClient; d: DeviceLinksState; t: Dict; onReload: () => Promise<unknown>; onUnlink: () => void }) {
  const info = d.devices.find((x) => x.kind === client);
  const nuvio = client === "nuvio";
  const [fresh, setFresh] = useState<StremioLinkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const issue = async (thenOpen: boolean) => {
    setBusy(true);
    try {
      const r = await v1Post<StremioLinkResult>("/api/v1/me/stremio/link", { action: "issue", client }, t);
      setFresh(r);
      void onReload();
      if (thenOpen && r.install_url) window.location.href = r.install_url;
    } catch (e) {
      errOf(e);
    } finally {
      setBusy(false);
    }
  };
  const linked = !!info?.linked || !!fresh?.linked;
  const can = canLinkNow(d, client);
  const install = nuvio ? t.nuvioInstall : t.stremioInstall;
  return (
    <div className="pb-5">
      <Head kind={client} d={d} t={t} intro={nuvio ? t.nuvioIntro : t.stremioIntro} needs={nuvio ? t.nuvioHow : t.stremioCoverage} />
      <div className="mx-5 mt-4 space-y-2">
        {fresh?.manifest_url ? (
          <>
            {fresh.install_url && (
              <a href={fresh.install_url} className={buttonClass({ full: true })}>
                {install}
              </a>
            )}
            <Group>
              <RowBtn icon="copy" title={t.stremioCopy} onClick={() => void copy(fresh.manifest_url!, t.stremioCopied)} />
              {fresh.web_install_url && (
                <a href={fresh.web_install_url} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                  <Icon name="compass" size={19} className="shrink-0" />
                  <span className="text-sm font-semibold">{t.stremioInstallWeb}</span>
                </a>
              )}
            </Group>
            <p className="px-1 text-12 text-muted leading-relaxed">{t.stremioLinkOnce}</p>
          </>
        ) : !linked && can ? (
          <>
            <button type="button" disabled={busy} className={buttonClass({ full: true })} onClick={() => void issue(true)}>
              {install}
            </button>
            <button type="button" disabled={busy} className={buttonClass({ variant: "ghost", full: true })} onClick={() => void issue(false)}>
              {t.stremioCopy}
            </button>
            <p className="px-1 text-12 text-muted leading-relaxed">{t.stremioLinkOnce}</p>
          </>
        ) : null}
      </div>
      {!linked && !can && <FullCard d={d} t={t} />}
      {linked && (
        <Group label={t.deviceAfter}>
          <RowBtn icon="repeat" title={t.stremioNewLink} sub={t.stremioNewLinkSub} busy={busy} onClick={() => void issue(false)} />
          <RowBtn icon="trash" title={t.stremioRevoke} danger onClick={onUnlink} />
        </Group>
      )}
      <p className="mx-6 mt-3 text-12 text-muted leading-relaxed">{nuvio ? t.nuvioAlwaysAsks : t.stremioAlwaysAsks}</p>
    </div>
  );
}

/* ============================================================ تأكيدُ الفكّ — الجملةُ نفسُها في التطبيق */
function UnlinkBody({ kind, works, t, onState, onDone, onBack }: { kind: DeviceKind; works: number; t: Dict; onState: (s: DeviceLinksState) => void; onDone: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      onState(await linksWrite({ action: "revoke", kind }, t));
      toast(kind === "kodi" ? t.kodiRevoked : t.linksUnlinked(deviceName(kind)));
      onDone();
    } catch (e) {
      errOf(e);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4 px-5 py-5">
      <p className="text-sm leading-relaxed">{t.linksUnlinkConfirm(deviceName(kind), works)}</p>
      <button type="button" disabled={busy} className={buttonClass({ variant: "danger", full: true })} onClick={() => void go()}>
        {t.linksUnlink}
      </button>
      <button type="button" className={buttonClass({ variant: "ghost", full: true })} onClick={onBack}>
        {t.cancelLabel}
      </button>
    </div>
  );
}
