"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { buttonClass } from "../ui/Button";
import { sheetScroll } from "../ui/controls";
import { Sheet, SheetHeader } from "../ui/Sheet";
import { DeviceMark } from "./DeviceMark";
import { DeviceSheet } from "./DeviceSheet";
import { canLinkNow, deviceName, linksWrite, useLinksState } from "./linksApi";
import { LINK_WORDS } from "./linkWords";
import { flashError, toast } from "@/lib/toast";
import { getDict, type Dict, type Locale } from "@/core/i18n";
import { DEVICE_KINDS } from "@/core/deviceLinks";
import type { DeviceKind, DeviceLinksState } from "@/core/contracts/deviceLinks";

/**
 * ====== 🆕 «الربط» في الويب — التصميم «أ» (أحمد ١٨ نوفمبر: «أ نفذ») ======
 *
 * 🔑 **المدارُ بطلُ الصفحة**: الشعارُ في القلب، والخاناتُ حوله باتّجاه الساعة من الأعلى (المربوطُ بخطٍّ إلى القلب، ثمّ الفارغُ «+»،
 * ثمّ المقفلُ «PLUS» للمجانيّ) — منطقُ `apps/mobile/src/links/Orbit.tsx › slotsOf` بحرفه، فالعدُّ واحدٌ في المنصّتين.
 * 🔑 **السحبُ بالفأرة**: تطبيقٌ من العمود الجانبيّ يُسحب إلى المدار فتُفتح ورقتُه وخطواتُه (السحبُ في الجوّال ضغطٌ مطوَّل؛ الفأرةُ لا
 * تحتاجه). والضغطُ على «اربط» أو على خانةٍ يفتح الطريقَ نفسَه. ما دون الحاسوب يلتفّ عموداً: المدارُ ثمّ القائمة.
 * 🔑 **ما يجري في التطبيق وحده يقول ذلك**: استيرادُ Plex يقرأ سيرفرَ البيت من شبكة الجوّال، فصفُّه هنا «في التطبيق» لا زرٌّ يفشل.
 */
type Slot = { type: "device"; kind: DeviceKind; waiting: boolean } | { type: "empty" } | { type: "locked" };

function slotsOf(d: DeviceLinksState): Slot[] {
  const linked: Slot[] = d.devices.filter((x) => x.linked && !x.stopped).map((x) => ({ type: "device", kind: x.kind, waiting: !x.used_at }));
  const limit = d.limit ?? Math.min(8, Math.max(5, d.used + 1));
  const total = d.limit == null ? limit : 5;
  const out: Slot[] = [...linked];
  const pending = d.pending_legacy && !d.pending_legacy.stopped ? 1 : 0;
  while (out.length < total) {
    const filled = out.length + pending;
    out.push(filled < limit ? { type: "empty" } : { type: "locked" });
  }
  return out.slice(0, total);
}

export function LinksView({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const w = LINK_WORDS[locale === "en" ? "en" : "ar"];
  const { state: d, setState, failed, reload } = useLinksState();
  const [open, setOpen] = useState<DeviceKind | null>(null);
  const [adding, setAdding] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [drag, setDrag] = useState<DeviceKind | null>(null);
  const [hot, setHot] = useState(false);

  if (!d) {
    return failed ? (
      <button type="button" className={buttonClass({ variant: "surface" })} onClick={() => void reload()}>
        {t.errorRetry}
      </button>
    ) : (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[460px] animate-pulse rounded-3xl bg-surface" />
        <div className="h-[460px] animate-pulse rounded-3xl bg-surface" />
      </div>
    );
  }

  const free = d.tier === "free";
  const full = d.limit != null && d.used >= d.limit;
  const stopped = d.devices.filter((x) => x.linked && x.stopped).length;
  const counter = free ? t.linksCounterFree(d.used) : d.limit == null ? t.linksCounterGold(d.used) : t.linksCounterPlus(d.used, d.limit);
  const needs: Record<DeviceKind, string> = {
    stremio: w.stremioNeeds,
    plex: t.devicePlexNeeds,
    jellyfin: t.deviceJellyfinNeeds,
    emby: t.deviceEmbyNeeds,
    kodi: t.deviceKodiNeeds,
  };

  const onSlot = (s: Slot) => {
    if (s.type === "device") setOpen(s.kind);
    else if (s.type === "empty") setAdding(true);
  };
  const dropOn = (kind: DeviceKind | null) => {
    setHot(false);
    setDrag(null);
    if (kind) setOpen(kind);
  };
  const setAuto = async (v: boolean) => {
    try {
      setState(await linksWrite({ action: "auto_mark", value: v }, t));
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
    }
  };
  const revokeLegacy = async () => {
    try {
      setState(await linksWrite({ action: "revoke_legacy" }, t));
      toast(t.linksUnlinked("Plex · Jellyfin · Emby"));
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ===== المدار و«مع Loopz Plus» ===== */}
        <div className="min-w-0 space-y-4">
          {stopped > 0 && (
            <button
              type="button"
              onClick={() => setKeeping(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-start"
            >
              <Icon name="pause" size={19} className="shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{t.keepCard(stopped)}</span>
                {d.limit != null && <span className="block text-12 text-muted">{t.keepSub(d.limit)}</span>}
              </span>
            </button>
          )}
          <div
            className={`rounded-3xl border bg-surface px-4 pt-6 pb-5 transition ${hot ? "border-accent" : "border-border"}`}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              setHot(true);
            }}
            onDragLeave={() => setHot(false)}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(drag ?? ((e.dataTransfer.getData("text/plain") as DeviceKind) || null));
            }}
          >
            <Orbit d={d} t={t} hot={hot} onSlot={onSlot} />
            <p className="mt-2 text-center text-xl font-extrabold">{counter}</p>
            <p className="mt-1 text-center text-12 text-muted">
              {hot ? (
                t.linksDropHere
              ) : (
                <>
                  <span className="hidden lg:inline">{w.dragHint}</span>
                  <span className="lg:hidden">{w.tapHint}</span>
                </>
              )}
            </p>
          </div>

          {d.pending_legacy && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
              <Icon name="tv" size={19} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t.linksPendingLegacy}</span>
                <span className="block text-12 text-muted">{t.linksPendingLegacySub}</span>
              </span>
              <button type="button" className={buttonClass({ variant: "danger", size: "sm" })} onClick={() => void revokeLegacy()}>
                {t.linksUnlink}
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface">
            <p className="px-4 pt-3 text-sm font-bold">{t.linksWithPlus}</p>
            {free ? (
              <Link href="/plus" className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                <Icon name="repeat" size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.autoMarkTitle}</span>
                  <span className="block text-12 text-muted">{t.autoMarkSub}</span>
                </span>
                <PlusPill />
              </Link>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={d.auto_mark}
                onClick={() => void setAuto(!d.auto_mark)}
                className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-surface-2"
              >
                <Icon name="repeat" size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{t.autoMarkTitle}</span>
                  <span className="block text-12 text-muted">
                    {t.autoMarkSub} · {w.stremioAsks}
                  </span>
                </span>
                <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition ${d.auto_mark ? "bg-accent" : "bg-border"}`}>
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-[color:var(--background)] shadow transition-all ${d.auto_mark ? "start-[22px]" : "start-0.5"}`}
                  />
                </span>
              </button>
            )}
            <div className="flex items-center gap-3 border-t border-[color:var(--divider)] px-4 py-3 opacity-80">
              <Icon name="clock" size={20} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t.plexImportRow}</span>
                <span className="block text-12 text-muted">{w.plexInApp}</span>
              </span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-12 font-bold text-muted">{w.inApp}</span>
            </div>
          </div>
        </div>

        {/* ===== من تطبيقاتك ===== */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">{t.linksDevices}</h2>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-12 font-bold text-muted">{w.free}</span>
          </div>
          <ul className="space-y-2">
            {DEVICE_KINDS.map((k) => {
              const info = d.devices.find((x) => x.kind === k);
              const linked = !!info?.linked;
              const paused = !!info?.stopped;
              const waiting = linked && !paused && !info?.used_at;
              const can = canLinkNow(d, k);
              const draggable = !linked && can;
              return (
                <li
                  key={k}
                  draggable={draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", k);
                    e.dataTransfer.effectAllowed = "link";
                    setDrag(k);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setHot(false);
                  }}
                  className={`flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3 ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
                    !linked && !can ? "opacity-55" : ""
                  } ${drag === k ? "opacity-50" : ""}`}
                >
                  <span className={`shrink-0 text-muted ${draggable ? "" : "invisible"}`} aria-hidden>
                    <Icon name="grip" size={16} />
                  </span>
                  <DeviceMark kind={k} size={42} state={paused ? "paused" : waiting ? "waiting" : linked ? "on" : "idle"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-15 font-bold">
                      <bdi>{deviceName(k)}</bdi>
                    </span>
                    <span className="block truncate text-12 text-muted">
                      {paused ? t.linksStopped : waiting ? t.deviceWaitingPill : linked ? t.stremioLinked : !can && full ? t.linksSlotFull : needs[k]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(k)}
                    className={buttonClass({ variant: linked ? "surface" : "primary", size: "sm", className: "shrink-0" })}
                  >
                    {linked ? w.manage : w.link}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-start gap-3 rounded-2xl border border-[#7b5cff]/50 bg-[#7b5cff]/10 p-3.5">
            <Icon name="info" size={18} className="mt-0.5 shrink-0 text-[#a594ff]" />
            <p className="text-12 leading-relaxed">{w.askHome}</p>
          </div>
          {free && (
            <div className="rounded-2xl border border-accent/35 bg-accent/10 p-3.5">
              <p className="text-sm font-semibold leading-relaxed">{t.linksFreeCard}</p>
              <Link href="/plus" className={buttonClass({ size: "sm", className: "mt-2.5" })}>
                {t.linksLearnMore}
              </Link>
            </div>
          )}
        </aside>
      </div>

      {open && <DeviceSheet kind={open} d={d} t={t} onState={setState} onReload={reload} onClose={() => setOpen(null)} />}
      {adding && (
        <AddSheet
          d={d}
          t={t}
          onClose={() => setAdding(false)}
          onPick={(k) => {
            setAdding(false);
            setOpen(k);
          }}
        />
      )}
      {keeping && d.limit != null && <KeepSheet d={d} t={t} limit={d.limit} onState={setState} onClose={() => setKeeping(false)} />}
    </>
  );
}

function PlusPill() {
  return (
    <span className="shrink-0 rounded-md bg-accent/15 px-1.5 py-0.5 text-12 font-bold leading-none tracking-wide text-accent" dir="ltr">
      PLUS
    </span>
  );
}

/* ───────── المدار — يقيس عرضَ حاويته فيصغر على الجوّال ويكبر على الحاسوب ───────── */
function Orbit({ d, t, hot, onSlot }: { d: DeviceLinksState; t: Dict; hot: boolean; onSlot: (s: Slot) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tile = width >= 420 ? 64 : 50;
  const R = Math.max(90, Math.min(165, (width - tile - 40) / 2));
  const H = 2 * R + tile + 34;
  const hub = R >= 140 ? 96 : 68;
  const cx = width / 2;
  const cy = H / 2;
  const slots = slotsOf(d);
  const pos = slots.map((_, i) => {
    const a = (i / slots.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  return (
    <div ref={box} className="relative w-full" style={{ height: H }} role="group" aria-label={t.linksOrbitLabel(d.used, d.limit ?? d.used)} dir="ltr">
      <svg width={width} height={H} className="absolute inset-0" aria-hidden>
        <defs>
          <radialGradient id="lzOrbitGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="var(--accent)" stopOpacity={hot ? 0.24 : 0.14} />
            <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R + 40} fill="url(#lzOrbitGlow)" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={hot ? "var(--accent)" : "var(--border)"} strokeWidth={1.5} />
        {slots.map((s, i) =>
          s.type === "device" ? (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={pos[i].x}
              y2={pos[i].y}
              stroke="var(--accent)"
              strokeOpacity={0.75}
              strokeWidth={1.75}
              strokeDasharray={s.waiting ? "5 5" : undefined}
            />
          ) : null,
        )}
      </svg>
      {/* القلبُ أسودُ في كلِّ ثيم: الشعارُ أبيض، وعلى خلفيّة النهار كان يختفي */}
      <span
        className="absolute grid place-items-center rounded-full border-[1.5px] border-accent bg-[#050505]"
        style={{ left: cx - hub / 2, top: cy - hub / 2, width: hub, height: hub }}
      >
        <Image src="/loopz-mark.png" alt="" width={Math.round(hub * 0.58)} height={Math.round(hub * 0.58)} unoptimized />
      </span>
      {slots.map((s, i) => {
        const style = { left: pos[i].x - tile / 2, top: pos[i].y - tile / 2 };
        if (s.type === "device")
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSlot(s)}
              className="absolute flex flex-col items-center gap-1.5 transition hover:scale-105"
              style={style}
              title={deviceName(s.kind)}
            >
              <DeviceMark kind={s.kind} size={tile} state={s.waiting ? "waiting" : "on"} />
              <span className="text-12 font-semibold">{deviceName(s.kind)}</span>
            </button>
          );
        if (s.type === "empty")
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSlot(s)}
              aria-label={t.linksAddTitle}
              className={`absolute grid place-items-center rounded-[var(--radius-control)] border-[1.5px] border-dashed transition hover:border-accent hover:text-accent ${
                hot ? "border-accent text-accent" : "border-border text-muted"
              }`}
              style={{ ...style, width: tile, height: tile }}
            >
              <Icon name="plus" size={22} />
            </button>
          );
        return (
          <Link
            key={i}
            href="/plus"
            aria-label={t.linksPlusSlot}
            className="absolute grid place-items-center rounded-[var(--radius-control)] border border-border bg-surface-2 transition hover:border-accent"
            style={{ ...style, width: tile, height: tile }}
          >
            <Icon name="lock" size={16} className="text-muted" />
            <span className="text-[10px] font-extrabold tracking-wide text-accent">PLUS</span>
          </Link>
        );
      })}
    </div>
  );
}

/* ───────── «أضف تطبيقاً» — من خانةٍ فارغة ───────── */
function AddSheet({ d, t, onClose, onPick }: { d: DeviceLinksState; t: Dict; onClose: () => void; onPick: (k: DeviceKind) => void }) {
  const unlinked = DEVICE_KINDS.filter((k) => !d.devices.find((x) => x.kind === k)?.linked);
  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} variant="bottom" labelledBy="links-add-title">
      <SheetHeader id="links-add-title" title={t.linksAddTitle} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="flex flex-wrap justify-center gap-4 px-5 py-5">
        {unlinked.map((k) => (
          <button key={k} type="button" onClick={() => onPick(k)} className="flex w-16 flex-col items-center gap-1.5 transition hover:scale-105">
            <DeviceMark kind={k} size={56} />
            <span className="text-12 font-semibold">{deviceName(k)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ───────── «اختر ما يبقى» — بعد النزول: ما زاد على الخانات موقوف، والعضوُ يختار ───────── */
function KeepSheet({ d, t, limit, onState, onClose }: { d: DeviceLinksState; t: Dict; limit: number; onState: (s: DeviceLinksState) => void; onClose: () => void }) {
  const linked = d.devices.filter((x) => x.linked);
  const [pick, setPick] = useState<DeviceKind[]>(linked.filter((x) => !x.stopped).map((x) => x.kind).slice(0, limit));
  const [busy, setBusy] = useState(false);
  const toggle = (k: DeviceKind) =>
    setPick((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= limit ? [...p.slice(1), k] : [...p, k]));
  const save = async () => {
    setBusy(true);
    try {
      onState(await linksWrite({ action: "keep", kinds: pick }, t));
      toast(t.keepSaved);
      onClose();
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} variant="bottom" labelledBy="links-keep-title" className="flex flex-col">
      <SheetHeader id="links-keep-title" title={t.keepTitle} closeLabel={t.closeLabel} onClose={onClose} />
      <div className={sheetScroll}>
        <p className="px-5 pt-4 text-sm text-muted leading-relaxed">{t.keepSub(limit)}</p>
        <ul className="space-y-2 px-5 py-4">
          {linked.map((x) => {
            const on = pick.includes(x.kind);
            return (
              <li key={x.kind}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(x.kind)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition ${on ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
                >
                  <DeviceMark kind={x.kind} size={40} state={x.stopped ? "paused" : "on"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{deviceName(x.kind)}</span>
                    <span className="block text-12 text-muted">{x.stopped ? t.linksStopped : t.stremioLinked}</span>
                  </span>
                  {on && <Icon name="check" size={18} className="text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-5 pb-5">
          <button type="button" disabled={busy || pick.length === 0} className={buttonClass({ full: true })} onClick={() => void save()}>
            {t.keepSave}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
