"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";
import { getDict, type Locale } from "@/core/i18n";
import { backdropUrl } from "@/core/media";
import { CHAT_BG_DOODLE_OPACITY, sameChatBg, type ChatBg } from "@/core/chatBg";
import type { ChatBgChoice } from "@/core/contracts/settings";
import { getChatBgState, setChatBg } from "@/lib/actions";
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
      <div className="px-5 pb-5 space-y-2.5" role="radiogroup" aria-labelledby="chat-bg-title">
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
              <span key={i} className="aspect-[16/10] rounded-xl bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : choices.length === 0 ? (
          <p className="text-12 text-muted">{t.chatBgFavsEmpty}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {choices.map((c) => {
              const value: ChatBg = { k: "title", type: c.type, id: c.id, path: c.path };
              const on = !!bg && sameChatBg(bg, value);
              return (
                <button
                  key={`${c.type}-${c.id}`}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c.title}
                  onClick={() => (plus ? pick(value) : router.push("/plus"))}
                  className="min-w-0 text-start"
                >
                  <span
                    className={`relative block aspect-[16/10] overflow-hidden rounded-xl border-2 ${on ? "border-accent" : "border-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- مصغّرةٌ في ورقة: `w300` من TMDB مباشرةً */}
                    <img
                      src={backdropUrl(c.path, "w300") ?? undefined}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover ${plus ? "" : "opacity-45"}`}
                    />
                    {on ? (
                      <span className="absolute top-1.5 end-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[color:var(--on-accent)]">
                        <Icon name="check" size={12} />
                      </span>
                    ) : !plus ? (
                      <span className="absolute top-1.5 end-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white">
                        <Icon name="lock" size={11} />
                      </span>
                    ) : null}
                  </span>
                  <span className={`mt-1 block truncate text-12 ${plus ? "" : "text-muted"}`}>{c.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {choices === null ? null : plus ? (
          choices && choices.length > 0 ? <p className="pt-1 text-12 text-muted">{t.chatBgFavsHint}</p> : null
        ) : (
          <Button variant="primary" size="lg" full className="mt-2" onClick={() => router.push("/plus")}>
            {t.chatBgUnlock}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
