"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";
import { sheetScroll } from "./ui/controls";
import { getDict, type Locale } from "@/core/i18n";
import { posterUrl } from "@/core/media";
import { CHAT_BG_DOODLE_OPACITY, sameChatBg, type ChatBg } from "@/core/chatBg";
import type { ChatBgChoice, ChatBgPostersPayload } from "@/core/contracts/settings";
import { getChatBgPosters, getChatBgState, setChatBg } from "@/lib/actions";
import { coalescedRefresh } from "@/core/refresh";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * 🆕 D-1382 — منتقي خلفيّة المحادثات (الويب) — ماكيتُ أحمد المعتمد بحرفه:
 * صفّان (Loopz الافتراضيّة · بلا رسوم) ثمّ شبكةُ «من مفضّلاتك» بشارة Loopz+.
 *
 * • **الاختيارُ يُطبَّق لحظةَ اللمس ولا تُغلق الورقة** — كالثيم: يُجرَّب الثاني والثالث والمحادثةُ تحتها تتبدّل.
 * • **غيرُ المشترك يرى المفضّلاتِ باهتةً بقفل** وزرّاً إلى `/plus`: رؤيةُ أعماله نفسِها هي ما يبيع الميزة —
 *   وقسمٌ مخفيٌّ لا يُشتهى. والحارسُ في الخادم (`updateUiState`) لا هنا.
 * • المفضّلاتُ تُجلب عند الفتح وحدَه (`getChatBgState(true)`).
 * • 🆕 D-1384 — **خطوتان**: لمسُ عملٍ يفتح ملصقاتِه (`getChatBgPosters` — ملصقُك · بلا كتابة · مع العنوان)، ولمسُ ملصقٍ
 *   يطبّقه — فما يُختار هو ما يُرى خلف المحادثة بالضبط (توأمُ `ChatBgSheet` في التطبيق).
 */
export function ChatBgSheet({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [bg, setBg] = useState<ChatBg | null>(null);
  const [plus, setPlus] = useState(false);
  const [choices, setChoices] = useState<ChatBgChoice[] | null>(null);
  /* 🆕 D-1383 — فشلُ الجلب حالةٌ تُقال («أعد المحاولة») لا «لا مفضّلات» ولا قفلٌ على مشترك */
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, start] = useTransition();
  /* 🆕 D-1384 — العملُ المفتوح وملصقاتُه (`undefined` = يُحمَّل · `null` = فشل) */
  const [title, setTitle] = useState<ChatBgChoice | null>(null);
  const [posters, setPosters] = useState<ChatBgPostersPayload | null | undefined>(undefined);

  function openTitle(c: ChatBgChoice) {
    tap(6);
    setTitle(c);
    setPosters(undefined);
    getChatBgPosters(c.type, c.id)
      .then((d) => setPosters(d))
      .catch(() => setPosters(null));
  }

  useEffect(() => {
    if (!open) return;
    let live = true;
    getChatBgState(true)
      .then((s) => {
        if (!live) return;
        setBg(s.bg);
        setPlus(s.plus);
        setChoices(s.choices ?? []);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, attempt]);

  function pick(next: ChatBg) {
    if (bg && sameChatBg(bg, next)) return;
    tap(6);
    const prev = bg;
    setBg(next);
    start(async () => {
      try {
        const r = await setChatBg(next);
        if (r.needsPlus) {
          setBg(prev);
          router.push("/plus");
          return;
        }
        if (!r.ok) throw new Error(t.errSaveShort);
        coalescedRefresh(router);
      } catch (e) {
        setBg(prev);
        flashError((e as Error).message);
      }
    });
  }

  const row = (value: ChatBg, title: string, sub: string, thumb: React.ReactNode) => {
    const on = !!bg && sameChatBg(bg, value);
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => pick(value)}
        className={`w-full flex items-center gap-3 rounded-2xl border p-2.5 text-start transition ${
          on ? "border-accent" : "border-border hover:bg-surface-2"
        }`}
      >
        <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-background">{thumb}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-15 font-semibold">{title}</span>
          <span className="block text-12 text-muted">{sub}</span>
        </span>
        <span
          aria-hidden
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-accent" : "border-muted"}`}
        >
          {on ? <span className="h-2.5 w-2.5 rounded-full bg-accent" /> : null}
        </span>
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} closeLabel={t.closeLabel} variant="bottom" labelledBy="chat-bg-title">
      <SheetHeader id="chat-bg-title" title={t.chatBgTitle} closeLabel={t.closeLabel} onClose={onClose} divider={false}>
        <p className="text-12 text-muted">{t.chatBgSub}</p>
      </SheetHeader>
      {title ? (
        <div className={`${sheetScroll} px-5 pb-5 space-y-4`}>
          <button
            type="button"
            onClick={() => setTitle(null)}
            aria-label={t.chatBgBackAria}
            className="flex items-center gap-2 text-start active:opacity-70"
          >
            <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
            <span className="min-w-0">
              <span className="block truncate text-15 font-bold">{title.title}</span>
              <span className="block text-12 text-muted">{t.chatBgPickPoster}</span>
            </span>
          </button>
          {posters === undefined ? (
            <div className="grid grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="aspect-[2/3] rounded-xl bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : posters === null ? (
            <div className="flex items-center gap-3">
              <p className="text-12 text-muted">{t.apiInternal}</p>
              <Button variant="ghost" size="sm" onClick={() => openTitle(title)}>
                {t.errorRetry}
              </Button>
            </div>
          ) : (
            (() => {
              const mine = posters.mine;
              const groups: [string, string[]][] = [
                [t.chatBgMine, mine ? [mine] : []],
                [t.chatBgClean, posters.clean.filter((p) => p !== mine)],
                [t.chatBgTitled, posters.titled.filter((p) => p !== mine)],
              ];
              if (groups.every(([, ps]) => ps.length === 0)) return <p className="text-12 text-muted">{t.chatBgNoPosters}</p>;
              return groups.map(([label, ps]) =>
                ps.length === 0 ? null : (
                  <div key={label} className="space-y-2" role="radiogroup" aria-label={label}>
                    <p className="text-14 font-bold">{label}</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {ps.map((path) => {
                        const value: ChatBg = { k: "poster", type: title.type, id: title.id, path };
                        return <PosterTile key={path} path={path} on={!!bg && sameChatBg(bg, value)} onClick={() => pick(value)} />;
                      })}
                    </div>
                  </div>
                ),
              );
            })()
          )}
        </div>
      ) : (
      <div className={`${sheetScroll} px-5 pb-5 space-y-2.5`} role="radiogroup" aria-labelledby="chat-bg-title">
        {row(
          { k: "loopz" },
          t.chatBgLoopz,
          t.chatBgLoopzSub,
          <span
            className="absolute inset-0"
            style={{
              backgroundColor: "var(--foreground)",
              opacity: CHAT_BG_DOODLE_OPACITY * 2.5,
              WebkitMaskImage: "url(/chat-doodle.png)",
              maskImage: "url(/chat-doodle.png)",
              WebkitMaskSize: "90px 90px",
              maskSize: "90px 90px",
            }}
          />,
        )}
        {row({ k: "plain" }, t.chatBgPlain, t.chatBgPlainSub, null)}

        <div className="flex items-center gap-2 pt-3">
          <p className="text-15 font-bold">{t.chatBgFavs}</p>
          <span className="rounded-full border border-accent px-2 text-[10px] font-bold leading-5 text-accent">{t.plusName}</span>
        </div>
        {plus && choices && choices.length > 0 ? <p className="-mt-1.5 text-12 text-muted">{t.chatBgFavsHint}</p> : null}

        {failed && choices === null ? (
          <div className="flex items-center gap-3">
            <p className="text-12 text-muted">{t.apiInternal}</p>
            <Button variant="ghost" size="sm" onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}>
              {t.errorRetry}
            </Button>
          </div>
        ) : choices === null ? (
          <div className="grid grid-cols-3 gap-2.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="aspect-[2/3] rounded-xl bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : choices.length === 0 ? (
          <p className="text-12 text-muted">{t.chatBgFavsEmpty}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {choices.map((c) => (
              <PosterTile
                key={`${c.type}-${c.id}`}
                path={c.path}
                label={c.title}
                on={!!bg && bg.k === "poster" && bg.type === c.type && bg.id === c.id}
                locked={!plus}
                onClick={() => (plus ? openTitle(c) : router.push("/plus"))}
              />
            ))}
          </div>
        )}

        {choices === null || plus ? null : (
          <Button variant="primary" size="lg" full className="mt-2" onClick={() => router.push("/plus")}>
            {t.chatBgUnlock}
          </Button>
        )}
      </div>
      )}
    </Sheet>
  );
}

/** ملصقٌ في الشبكة (٢:٣) — علامةُ الاختيار أو القفل في زاويته */
function PosterTile({ path, label, on, locked = false, onClick }: { path: string; label?: string; on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={label} onClick={onClick} className="min-w-0 text-start">
      <span className={`relative block aspect-[2/3] overflow-hidden rounded-xl border-2 bg-surface-2 ${on ? "border-accent" : "border-transparent"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- مصغّرةٌ في ورقة: `w342` من TMDB مباشرةً */}
        <img src={posterUrl(path, "w342") ?? undefined} alt="" loading="lazy" className={`h-full w-full object-cover ${locked ? "opacity-45" : ""}`} />
        {on ? (
          <span className="absolute top-1.5 end-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[color:var(--on-accent)]">
            <Icon name="check" size={12} />
          </span>
        ) : locked ? (
          <span className="absolute top-1.5 end-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white">
            <Icon name="lock" size={11} />
          </span>
        ) : null}
      </span>
      {label ? <span className={`mt-1 block truncate text-12 ${locked ? "text-muted" : ""}`}>{label}</span> : null}
    </button>
  );
}
