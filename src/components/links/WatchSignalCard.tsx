"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { buttonClass } from "../ui/Button";
import { v1Get, v1Post } from "../InboxComposer";
import { LINK_WORDS, episodeLabel } from "./linksApi";
import { flashError, toast } from "@/lib/toast";
import { coalescedRefresh } from "@/core/refresh";
import { backdropUrl } from "@/core/media";
import { timeAgo } from "@/core/when";
import { getDict, type Locale } from "@/core/i18n";
import { SIGNAL_SOURCE_NAME, signalSourceOf, type StremioAnswerBody, type StremioSignal, type StremioState } from "@/core/contracts/stremio";

/**
 * ====== 🆕 «من تطبيقاتك — شفتها؟» في رئيسيّة الويب (T409، التصميم المعتمد `a_home`) ======
 *
 * ما شغّلتَه على تطبيقٍ مربوط (Stremio · Plex · Jellyfin · Emby · Kodi) يسألك عنه Loopz: ✓ تعلّمه (وكلَّ ما قبله للحلقة)،
 * ✕ تتجاهله — البابان نفساهما في التطبيق (`GET /api/v1/me/stremio` · `POST …/answer`). **سؤالٌ واحدٌ في كلِّ مرّة**: الأحدث،
 * وتحته كم ينتظر. والبطاقةُ لا تُرسم أصلاً لمن لا ينتظره شيء — لا صندوقٌ فارغٌ في الرئيسيّة.
 * والمسجَّلُ تلقائياً («سجّل بلا سؤال») لا يُطلب هنا: الويبُ يسأل عمّا يحتاج جواباً فقط.
 */
/* البطاقةُ مرسومةٌ مرّتين في الرئيسيّة (أعلى الرفوف دون الحاسوب، وأعلى العمود الجانبيّ فيه — واحدةٌ مخفيّةٌ بـCSS دائماً)،
   فالسؤالُ يُجلب مرّةً واحدةً للصفحة ويُشارَك، والجوابُ يُسقطه من الاثنتين معاً */
type Shared = { items: StremioSignal[]; count: number };
let shared: Shared | null = null;
let pending: Promise<Shared | null> | null = null;
const listeners = new Set<(s: Shared) => void>();
function load(): Promise<Shared | null> {
  if (shared) return Promise.resolve(shared);
  pending ??= v1Get<StremioState>("/api/v1/me/stremio").then((s) => {
    pending = null;
    if (!s) return null;
    shared = { items: s.items.filter((x) => !x.auto), count: s.count };
    /* تنتهي صلاحيّةُ النسخة المشتركة بعد دقيقة: العودةُ إلى الرئيسيّة لاحقاً تسأل من جديد */
    setTimeout(() => {
      shared = null;
    }, 60_000);
    return shared;
  });
  return pending;
}
function drop(id: number) {
  if (!shared) return;
  shared = { items: shared.items.filter((x) => x.id !== id), count: Math.max(0, shared.count - 1) };
  for (const f of listeners) f(shared);
}

export function WatchSignalCard({ locale, className = "" }: { locale: Locale; className?: string }) {
  const t = getDict(locale);
  const router = useRouter();
  const w = LINK_WORDS[locale === "en" ? "en" : "ar"];
  const [items, setItems] = useState<StremioSignal[] | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const on = (s: Shared) => {
      setItems(s.items);
      setCount(s.count);
    };
    listeners.add(on);
    void load().then((s) => s && on(s));
    return () => {
      listeners.delete(on);
    };
  }, []);

  const it = items?.[0];
  if (!it) return null;
  const source = SIGNAL_SOURCE_NAME[signalSourceOf(it.source)];
  const ep = episodeLabel(it);
  const img = backdropUrl(it.image_path, "w300");

  const answer = async (watched: boolean) => {
    setBusy(true);
    try {
      await v1Post("/api/v1/me/stremio/answer", { id: it.id, watched } satisfies StremioAnswerBody, t);
      toast(watched ? (ep ? t.stremioMarkedUpTo(ep) : t.stremioMarkedMovie) : t.stremioDismissed);
      drop(it.id);
      if (watched) coalescedRefresh(router);
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-[#7b5cff]/50 bg-gradient-to-b from-[#7b5cff]/15 to-surface p-4 ${className}`}>
      <p className="flex items-center gap-2 text-12 font-bold text-[#b9acff]">
        <Icon name="tv" size={15} />
        {w.fromApps(source)}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative block h-[54px] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
          {img ? <Image src={img} alt="" fill sizes="96px" className="object-cover" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold" dir="auto">
            {it.title}
          </span>
          <span className="block text-12 text-muted">
            {[ep || t.stremioMovie, `${t.stremioOpened} ${timeAgo(it.seen_at, t)}`].join(" · ")}
          </span>
          <span className="mt-1 block text-sm font-bold">{t.stremioAsk}</span>
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} className={buttonClass({ size: "sm", className: "flex-1" })} onClick={() => void answer(true)}>
          {t.stremioYes}
        </button>
        <button type="button" disabled={busy} className={buttonClass({ variant: "surface", size: "sm", className: "flex-1" })} onClick={() => void answer(false)}>
          {t.stremioNo}
        </button>
      </div>
      {count > 1 && <p className="mt-2 text-center text-12 text-muted">{w.waiting(count)}</p>}
    </div>
  );
}
