"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { setPlaybackActive } from "@/lib/playback";

const YT_ORIGIN = "https://www.youtube-nocookie.com";
const START_RATIO = 0.6;
const STOP_RATIO = 0.15;
const SWITCH_GAP = 0.05;
const VISIBILITY_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

type PlayerRegistration = {
  ratio: number;
  activate: () => void;
  deactivate: () => void;
};

const PLAYERS = new Map<symbol, PlayerRegistration>();
let ACTIVE: symbol | null = null;

function setActive(next: symbol | null) {
  if (ACTIVE === next) return;
  if (ACTIVE) PLAYERS.get(ACTIVE)?.deactivate();
  ACTIVE = next;
  if (next) PLAYERS.get(next)?.activate();
}

function reconcilePlayers() {
  let bestId: symbol | null = null;
  let bestRatio = 0;
  for (const [id, player] of PLAYERS) {
    if (player.ratio > bestRatio) {
      bestId = id;
      bestRatio = player.ratio;
    }
  }

  const current = ACTIVE ? PLAYERS.get(ACTIVE) : null;
  if (current && current.ratio >= STOP_RATIO) {
    if (
      bestId &&
      bestId !== ACTIVE &&
      bestRatio >= START_RATIO &&
      bestRatio > current.ratio + SWITCH_GAP
    ) {
      setActive(bestId);
    }
    return;
  }

  if (bestId && bestRatio >= START_RATIO) setActive(bestId);
  else setActive(null);
}

function registerPlayer(id: symbol, player: Omit<PlayerRegistration, "ratio">) {
  PLAYERS.set(id, { ...player, ratio: 0 });
}

function updatePlayerRatio(id: symbol, ratio: number) {
  const player = PLAYERS.get(id);
  if (!player) return;
  player.ratio = ratio;
  reconcilePlayers();
}

function unregisterPlayer(id: symbol) {
  const wasActive = ACTIVE === id;
  PLAYERS.delete(id);
  if (wasActive) ACTIVE = null;
  reconcilePlayers();
}

function manuallyActivate(id: symbol) {
  const player = PLAYERS.get(id);
  if (!player) return;
  if (ACTIVE && ACTIVE !== id) PLAYERS.get(ACTIVE)?.deactivate();
  ACTIVE = id;
  player.activate();
}

function isSaving(): boolean {
  try {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    return Boolean(connection?.saveData) || Boolean(connection?.effectiveType?.includes("2g"));
  } catch {
    return false;
  }
}

function clock(sec: number): string {
  const seconds = Math.max(0, Math.floor(sec));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type PlayerInfo = {
  currentTime?: number;
  duration?: number;
  playerState?: number;
  errorCode?: number;
};

type PlayerMessage = {
  event?: string;
  info?: number | PlayerInfo;
};

export function TrailerPlayer({
  videoKey,
  videoKeys,
  backdrop,
  title,
  muted,
  onMutedChange,
  playLabel,
  muteLabel,
  unmuteLabel,
  seekLabel,
  className = "",
  showProgress = true,
  href,
  openLabel,
  onOpen,
  onUnavailable,
}: {
  videoKey: string;
  videoKeys?: string[];
  backdrop: string | null;
  title: string;
  muted: boolean;
  onMutedChange: (next: boolean) => void;
  playLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  seekLabel?: string;
  className?: string;
  showProgress?: boolean;
  href?: string;
  openLabel?: string;
  onOpen?: () => void;
  onUnavailable?: () => void;
}) {
  const id = useRef(Symbol(title));
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const activeRef = useRef(false);
  const mountedRef = useRef(false);
  const mutedRef = useRef(muted);
  const atRef = useRef<{ now: number; total: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const unavailableRef = useRef(onUnavailable);

  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [manualOnly, setManualOnly] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [at, setAt] = useState<{ now: number; total: number } | null>(null);
  const [tryIdx, setTryIdx] = useState(0);
  const [launch, setLaunch] = useState(0);

  const keys = videoKeys?.length ? videoKeys : [videoKey];
  const key = keys[Math.min(tryIdx, keys.length - 1)];
  const dead = tryIdx >= keys.length;

  const send = useCallback((func: string, args: unknown[] = []) => {
    try {
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        YT_ORIGIN,
      );
    } catch {
      // The iframe may be between loads; activation always has a URL fallback.
    }
  }, []);

  const activate = useCallback(() => {
    activeRef.current = true;
    mountedRef.current = true;
    setMounted(true);
    setPlaying(false);
    setPaused(false);
    setStalled(false);
    setLaunch((value) => value + 1);
  }, []);

  const deactivate = useCallback(() => {
    activeRef.current = false;
    send("pauseVideo");
    setPlaying(false);
    setPaused(false);
    setStalled(false);
  }, [send]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    atRef.current = at;
  }, [at]);

  useEffect(() => {
    unavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    const playerId = id.current;
    registerPlayer(playerId, { activate, deactivate });
    const element = box.current;
    if (!element) return () => unregisterPlayer(playerId);

    const requiresTap = typeof IntersectionObserver === "undefined" || isSaving();
    if (requiresTap) {
      const timer = window.setTimeout(() => setManualOnly(true), 0);
      return () => {
        window.clearTimeout(timer);
        unregisterPlayer(playerId);
      };
    }

    const nearObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          mountedRef.current = true;
          setMounted(true);
          return;
        }
        mountedRef.current = false;
        updatePlayerRatio(playerId, 0);
        setMounted(false);
        setAt(null);
        setPaused(false);
        setStalled(false);
        setLaunch(0);
      },
      { rootMargin: "420px 0px" },
    );

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => updatePlayerRatio(playerId, entry.intersectionRatio),
      { threshold: VISIBILITY_THRESHOLDS },
    );

    nearObserver.observe(element);
    visibilityObserver.observe(element);
    return () => {
      nearObserver.disconnect();
      visibilityObserver.disconnect();
      unregisterPlayer(playerId);
    };
  }, [activate, deactivate]);

  useEffect(() => {
    const onVisibility = () => {
      if (!activeRef.current) return;
      if (document.visibilityState === "hidden") {
        send("pauseVideo");
        setPlaying(false);
        return;
      }
      setPlaying(false);
      setPaused(false);
      setStalled(false);
      setLaunch((value) => value + 1);
    };
    const onPageHide = () => send("pauseVideo");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [send]);

  useEffect(() => {
    if (!mounted || dead) return;
    let gotProgress = false;
    let drewFrame = false;
    let appliedSound = false;
    let failed = false;

    function onMessage(event: MessageEvent) {
      if (event.origin !== YT_ORIGIN || event.source !== frame.current?.contentWindow) return;
      let data: PlayerMessage;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const info = typeof data.info === "object" && data.info ? data.info : null;
      if (data.event === "onError" || typeof info?.errorCode === "number") {
        if (failed) return;
        failed = true;
        setPlaying(false);
        setAt(null);
        setTryIdx((value) => value + 1);
        return;
      }
      if (!info) return;

      if (!appliedSound && activeRef.current) {
        appliedSound = true;
        send(mutedRef.current ? "mute" : "unMute");
      }

      if (
        info.playerState === 1 &&
        typeof info.currentTime === "number" &&
        info.currentTime > 0.1
      ) {
        drewFrame = true;
        setPlaying(true);
        setPaused(false);
        setStalled(false);
      }

      if (
        activeRef.current &&
        (info.playerState === 2 || info.playerState === 0)
      ) {
        setPlaying(false);
        setPaused(true);
      }

      if (
        showProgress &&
        typeof info.currentTime === "number" &&
        typeof info.duration === "number" &&
        info.duration > 0
      ) {
        gotProgress = true;
        setAt({ now: info.currentTime, total: info.duration });
      }
    }

    window.addEventListener("message", onMessage);
    let tries = 0;
    const hello = window.setInterval(() => {
      if (gotProgress || tries++ > 20) {
        window.clearInterval(hello);
        return;
      }
      try {
        frame.current?.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: key, channel: "widget" }),
          YT_ORIGIN,
        );
      } catch {
        // The next handshake retries after the iframe finishes loading.
      }
    }, 400);

    const timeout = window.setTimeout(() => {
      if (!activeRef.current || drewFrame) return;
      send("pauseVideo");
      setPlaying(false);
      setStalled(true);
    }, 8000);

    return () => {
      window.clearInterval(hello);
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    };
  }, [mounted, dead, key, launch, showProgress, send]);

  useEffect(() => {
    if (!dead) return;
    unavailableRef.current?.();
  }, [dead]);

  useEffect(() => {
    if (!mounted || !activeRef.current) return;
    send(muted ? "mute" : "unMute");
  }, [muted, mounted, send]);

  useEffect(() => {
    const token = frame;
    setPlaybackActive(token, playing);
    return () => setPlaybackActive(token, false);
  }, [playing]);

  const seek = useCallback(
    (clientX: number) => {
      const element = bar.current;
      const total = atRef.current?.total ?? 0;
      if (!element || total <= 0) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0) return;
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const next = fraction * total;
      send("seekTo", [next, true]);
      setAt((value) => (value ? { ...value, now: next } : value));
    },
    [send],
  );

  const nudge = useCallback(
    (seconds: number) => {
      const current = atRef.current;
      if (!current || current.total <= 0) return;
      const next = Math.min(current.total, Math.max(0, current.now + seconds));
      send("seekTo", [next, true]);
      setAt((value) => (value ? { ...value, now: next } : value));
    },
    [send],
  );

  const startManually = () => manuallyActivate(id.current);
  const src =
    mounted && !dead && typeof window !== "undefined"
      ? `${YT_ORIGIN}/embed/${encodeURIComponent(key)}?autoplay=${launch > 0 ? 1 : 0}&mute=1&playsinline=1&controls=0&rel=0&modestbranding=1&loop=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
      : null;
  const progress = at && at.total > 0 ? Math.min(100, (at.now / at.total) * 100) : 0;

  return (
    <div ref={box} className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {src ? (
        <iframe
          key={`${key}:${launch}`}
          ref={frame}
          src={src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none", border: 0 }}
        />
      ) : null}

      <div
        className={`absolute inset-0 z-[1] bg-surface-2 transition-opacity duration-300 ${
          playing ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
            priority={false}
          />
        ) : null}
      </div>

      {href && playing ? (
        <Link
          href={href}
          prefetch={false}
          aria-label={openLabel ?? title}
          className="absolute inset-0 z-[5]"
          onClick={onOpen}
        />
      ) : null}

      {!playing && !dead ? (
        <button
          type="button"
          onClick={startManually}
          aria-label={playLabel}
          className="absolute inset-0 z-[6] grid place-items-center"
        >
          {stalled || paused || manualOnly ? (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
              <Icon name="play" size={26} />
            </span>
          ) : null}
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onMutedChange(!muted)}
        aria-label={muted ? unmuteLabel : muteLabel}
        className="absolute end-2.5 top-2.5 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition active:opacity-70"
      >
        <Icon name={muted ? "volume-off" : "volume"} size={17} />
      </button>

      {showProgress && at ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-6">
          <span dir="ltr" className="mb-1.5 block text-12 tabular-nums text-white/90">
            {clock(at.now)} / {clock(at.total)}
          </span>
          <div
            ref={bar}
            dir="ltr"
            role="slider"
            tabIndex={0}
            aria-label={seekLabel ?? title}
            aria-valuemin={0}
            aria-valuemax={Math.round(at.total)}
            aria-valuenow={Math.round(at.now)}
            aria-valuetext={`${clock(at.now)} / ${clock(at.total)}`}
            className="pointer-events-auto -my-2 cursor-pointer touch-pan-y py-2"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              seek(event.clientX);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientX);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                nudge(5);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                nudge(-5);
              }
            }}
          >
            <span className="block h-[3px] overflow-hidden rounded-full bg-white/25">
              <span
                className="block h-full bg-accent transition-[width] duration-500 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
