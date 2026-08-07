"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { coalescedRefresh } from "@/lib/refresh";
import { sendShare } from "@/lib/actions";
import type { MediaType } from "@/lib/media";
import type { PersonLite } from "@/lib/data";

/** أدنى عدد أحرف يُطلق البحث — مطابقٌ لحدّ `/api/suggest` */
const MIN = 2;

interface Suggestion {
  kind: "tv" | "movie" | "person";
  id: number;
  title: string;
  year?: string;
  poster: string | null;
  rating?: number | null;
}

/**
 * بدء محادثةٍ مع شخصٍ من الرسائل — دون كسر قاعدة D-051.
 *
 * أبقى المالك على القاعدة: لا محادثة تبدأ من فراغ، وكل رسالة معلَّقة بعمل.
 * فبدلاً من صندوق نصٍّ حرّ، هنا نختار **العمل** الذي نبدأ به: الطرف ثابتٌ
 * (اخترناه من البحث)، والبحث الآن عن عملٍ لا عن شخص. عند الاختيار يُرسَل
 * `title_share` — نفس فعل «أرسِله لـ…» لكن مقلوباً: شخصٌ أولاً ثم عمل — ثمّ
 * ننتقل إلى خيط المحادثة. القاعدة المتبادلة في SQL هي البوّاب (shares.sql).
 *
 * علوية لأن فيها كتابة: لوحة المفاتيح تأكل النصف السفلي (نمط ورقة البحث، D-018).
 */
export function StartConversationSheet({
  person,
  locale,
  onClose,
}: {
  person: PersonLite;
  locale: Locale;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const name = person.hide_name ? t.anonymousUser : person.nickname || person.username || "—";

  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // التركيز بعد إطارٍ واحد: الورقة تنقل التركيز إلى لوحها عند الفتح
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  function changeQ(value: string) {
    setQ(value);
    if (value.trim().length < MIN) {
      setItems([]);
      setTouched(false);
      setLoading(false);
    }
  }

  // العمل فقط — الشخص لا يُشارَك، إنما يُشارَك عملٌ معه (نُسقط kind==="person")
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        const titles = (data.results ?? []).filter(
          (s: Suggestion) => s.kind === "tv" || s.kind === "movie",
        );
        setItems(titles);
        setTouched(true);
      } catch {
        /* أُلغي الطلب أو فشل — يُتجاهل بصمت */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  function submit() {
    if (!picked || pending) return;
    tap([12, 30]);
    start(async () => {
      try {
        await sendShare({
          recipientId: person.id,
          tmdbId: picked.id,
          mediaType: picked.kind as MediaType,
          title: picked.title,
          posterPath: posterPathOf(picked.poster),
          note,
        });
        toast(t.shareSentToast, { tone: "success" });
        onClose();
        // ننتقل إلى الخيط الجديد ونطلب تحديثه ليظهر أول عمل
        router.push(`/people?tab=inbox&with=${person.id}`);
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const term = q.trim();

  return (
    <Sheet
      open
      variant="top"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="start-conv-title"
    >
      <SheetHeader
        id="start-conv-title"
        title={t.convStartTitle(name)}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        <p className="text-xs text-muted mt-0.5">{t.convStartHint}</p>
      </SheetHeader>

      {/* الطرف ثابتٌ فوق البحث — يُذكّر بمن نبدأ معه */}
      <div className="flex items-center gap-2.5 px-5 pt-3">
        <Avatar
          src={person.hide_name ? null : person.avatar_url}
          name={name}
          size={30}
          alt={t.avatarAlt}
        />
        <span className="text-sm font-semibold truncate">{name}</span>
      </div>

      {picked ? (
        /* عملٌ مُختار: بطاقةٌ صغيرة + سطرٌ اختياري + إرسال — كذيل «أرسِله لـ…» */
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5">
            <span className="relative block w-10 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2">
              {picked.poster ? (
                <Image src={picked.poster} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                  <Icon name="film" size={13} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold truncate">{picked.title}</span>
              <span className="block text-[11px] text-muted">
                {picked.kind === "tv" ? t.typeSeries : t.typeMovie}
                {picked.year ? ` · ${picked.year}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setPicked(null)}
              aria-label={t.closeLabel}
              className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.shareSendNotePlaceholder}
            aria-label={t.shareSendNotePlaceholder}
            maxLength={280}
            rows={2}
            className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 text-base outline-none focus:border-accent transition resize-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="w-full h-12 rounded-full bg-accent text-[color:var(--on-accent)] font-bold text-[15px] disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition"
          >
            {t.shareSendButton}
          </button>
        </div>
      ) : (
        <>
          <div className="px-5 pt-3 pb-2">
            <div className="relative">
              <span className="absolute inset-y-0 start-3.5 grid place-items-center text-muted pointer-events-none">
                <Icon name="search" size={18} />
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => changeQ(e.target.value)}
                placeholder={t.convStartSearchPlaceholder}
                aria-label={t.convStartSearchPlaceholder}
                className="w-full rounded-xl bg-surface-2 border border-border ps-10 pe-4 py-3 text-base outline-none focus:border-accent transition"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] min-h-[6rem]">
            {loading ? (
              <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
            ) : term.length < MIN ? (
              <p className="text-xs text-muted text-center py-8 px-5">{t.searchStart}</p>
            ) : items.length === 0 && touched ? (
              <p className="text-sm text-muted text-center py-8 px-5">{t.searchNoResults}</p>
            ) : (
              items.map((s) => (
                <button
                  key={`${s.kind}-${s.id}`}
                  type="button"
                  onClick={() => {
                    tap(6);
                    setPicked(s);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-start hover:bg-surface-2 transition"
                >
                  <span className="relative shrink-0 w-9 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
                    {s.poster ? (
                      <Image src={s.poster} alt="" fill sizes="36px" className="object-cover" />
                    ) : (
                      <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                        <Icon name={s.kind === "tv" ? "tv" : "film"} size={14} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{s.title}</span>
                    <span className="block text-[11px] text-muted truncate">
                      {s.kind === "tv" ? t.typeSeries : t.typeMovie}
                      {s.year ? ` · ${s.year}` : ""}
                    </span>
                  </span>
                  {s.rating != null && s.rating > 0 && (
                    <span className="text-[11px] font-bold text-accent tabular-nums shrink-0" dir="ltr">
                      ★ {s.rating}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

/**
 * الاقتراح يحمل رابط ملصقٍ كاملاً (`posterUrl(...,"w185")`)؛ و`sendShare`
 * يخزّن **المسار** لا الرابط (D-048، `safeImagePath` في الأكشن يتحقّق منه).
 * نستخرج المسار من الرابط، وإن تعذّر نرسل null — الخيط يعمل بلا ملصق.
 */
function posterPathOf(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/t\/p\/[^/]+(\/[A-Za-z0-9._-]+)$/);
  return m ? m[1] : null;
}
