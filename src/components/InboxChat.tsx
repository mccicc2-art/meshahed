"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { sheetMenuItem } from "./ui/controls";
import { buttonClass } from "./ui/Button";
import { getDict } from "@/core/i18n";
import { gifUrl, posterUrl } from "@/core/media";
import type { ConvEvent, ConvReplyEvent } from "@/lib/data";
import { MSG_UNSEND_WINDOW_MS, type MsgDeleteBody, type MsgDeletePayload } from "@/core/contracts/messages";
import { tap } from "@/lib/haptics";
import { v1Post } from "./InboxComposer";

/**
 * ====== 🆕 T397 — أفعالُ الرسالة في الويب: ردّ · نسخ · حذف، والوقتُ وعلامتا الوصول والقراءة ======
 *
 * 🔑 **ما يفعله التطبيقُ بالضغط المطوّل يفعله الويبُ بثلاثة أبواب** لأنّ المتصفّحَ ثلاثةُ أجهزة: على الحاسوب زرٌّ صغيرٌ
 * يظهر بجانب الفقاعة عند المرور (والزرُّ الأيمن)، وعلى اللمس ضغطٌ مطوّل — والثلاثةُ تفتح الورقةَ نفسَها.
 * 🔑 **ورقةُ الحذف ورقةُ التطبيق** (`DeleteSheet`، D-1441): «حذف للجميع» لرسائلي وحدها خلال ساعتين — القاعدةُ هي
 * الحَكَم (`message_unsend`) وهذا لإخفاء خيارٍ سيُرفض فقط — و«حذف عندي» دائماً.
 */

type Dict = ReturnType<typeof getDict>;

/** الساعةُ بصيغة التطبيق (`clockOf` في `chatFormat`): «٩:٤٢ م» · «9:42 PM» — بساعة القارئ */
export function clockOf(iso: string, t: Dict): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, "0");
  const h12 = h % 12 || 12;
  if (t.code === "en") return `${h12}:${mm} ${h < 12 ? "AM" : "PM"}`;
  return `${h12}:${mm} ${h < 12 ? "ص" : "م"}`;
}

/** علامةُ رسالتي (D-1401): ساعةٌ وهي تُرسل · ✓ وصلت · ✓✓ قرأها — ولا شيء على رسائل الطرف الآخر */
export function tickOf(e: { id: string; mine: boolean; read?: boolean }): "clock" | "check-line" | "check-double" | null {
  if (!e.mine) return null;
  if (e.id.startsWith("tmp-")) return "clock";
  if (typeof e.read !== "boolean") return null;
  return e.read ? "check-double" : "check-line";
}

/** «حذف للجميع» ممكنٌ؟ — كلُّ المحدَّد رسائلي وفي المهلة (نسخةُ التطبيق) */
export function canUnsend(items: { mine: boolean; created_at: string }[], now = Date.now()): boolean {
  return items.length > 0 && items.every((e) => e.mine && now - Date.parse(e.created_at) < MSG_UNSEND_WINDOW_MS);
}

export function deleteMessages(body: MsgDeleteBody, t: Dict): Promise<MsgDeletePayload> {
  return v1Post<MsgDeletePayload>("/api/v1/me/messages/delete", body, t);
}

/** الوقتُ والعلامةُ في زاوية الفقاعة — باهتٌ صغير، والساعةُ تُكتب في المتصفّح بساعته لا بساعة الخادم */
export function MsgMeta({ at, tick, t, onAccent }: { at: string; tick: ReturnType<typeof tickOf>; t: Dict; onAccent: boolean }) {
  const label = tick === "check-double" ? t.msgRead : tick === "check-line" ? t.msgDelivered : tick === "clock" ? t.msgSending : null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] leading-none ${onAccent ? "opacity-80" : "text-muted"}`} title={label ?? undefined}>
      <span suppressHydrationWarning>{clockOf(at, t)}</span>
      {tick ? (
        <span aria-label={label ?? undefined} className={tick === "check-double" && !onAccent ? "text-accent" : ""}>
          <Icon name={tick} size={tick === "clock" ? 11 : 14} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * غلافُ الفقاعة: زرُّ الأفعال يظهر بجانبها عند المرور على الحاسوب (ودائماً لمن ركّز عليه بلوحة المفاتيح)، والزرُّ
 * الأيمن يفتح الورقة، والضغطُ المطوّل على اللمس كذلك — **ونقرةٌ تلي الضغطَ المطوّل تُبتلع** كي لا تفتح الصورةَ تحته.
 */
export function MsgShell({
  mine,
  enabled,
  onMenu,
  label,
  className = "",
  selecting = false,
  selected = false,
  onToggle,
  children,
}: {
  mine: boolean;
  enabled: boolean;
  onMenu: () => void;
  label: string;
  className?: string;
  /** 🆕 R255 — **وضعُ التحديد** (توأمُ D-1401 في التطبيق): الضغطةُ تحدِّد وتُلغي بدل أن تفتح، والسطرُ كلُّه يُضاء */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  /* A-66 (المدقّق ١٨ نوفمبر) — مؤقّتُ الضغطة المطوّلة يُلغى عند مغادرة الفقاعة أيضاً: من ترك الخيط وإصبعُه عليها
     كانت قائمتُها تُفتح بعد ٤٥٠ م.ث على شاشةٍ لم تعد موجودة */
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  if (selecting) {
    /* السطرُ كلُّه هدفُ الضغطة (عرضُ الخيط لا عرضُ الفقاعة — كالواتس والتطبيق)، والروابطُ داخلها لا تُفتح وهو يحدِّد.
       وما لا يُحدَّد (المتفائلةُ ومحذوفٌ بلا فعل) يبقى معتماً لا يستجيب */
    return (
      <div
        role="checkbox"
        aria-checked={selected}
        aria-disabled={!enabled}
        tabIndex={enabled ? 0 : -1}
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (enabled) {
            tap(6);
            onToggle?.();
          }
        }}
        onKeyDown={(e) => {
          if (enabled && (e.key === " " || e.key === "Enter")) {
            e.preventDefault();
            onToggle?.();
          }
        }}
        className={`-mx-2 flex rounded-xl px-2 py-0.5 transition ${mine ? "justify-end" : "justify-start"} ${
          enabled ? "cursor-pointer" : "opacity-50"
        } ${selected ? "bg-[color:var(--accent)]/20" : enabled ? "hover:bg-surface-2/60" : ""}`}
      >
        <div className={`${className} pointer-events-none select-none`}>{children}</div>
      </div>
    );
  }
  if (!enabled) return <div className={className}>{children}</div>;
  const button = (
    <button
      type="button"
      onClick={() => {
        tap(6);
        onMenu();
      }}
      aria-label={label}
      title={label}
      className="shrink-0 self-center grid place-items-center w-7 h-7 rounded-full text-muted hover:text-foreground hover:bg-surface-2 opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100 transition [@media(hover:none)]:hidden"
    >
      <Icon name="dots" size={14} />
    </button>
  );
  return (
    <div
      className={`group/msg flex items-end gap-1 ${mine ? "justify-end" : "justify-start"} ${className}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu();
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          timer.current = null;
          tap(10);
          onMenu();
        }, 450);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) clear();
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
      onClickCapture={(e) => {
        if (fired.current) {
          fired.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {mine ? button : null}
      <div className="min-w-0 max-w-full flex flex-col [-webkit-touch-callout:none] [@media(hover:none)]:select-none">{children}</div>
      {mine ? null : button}
    </div>
  );
}

/** ورقةُ أفعال رسالةٍ واحدة — الأخطرُ أخيراً */
export function MsgMenuSheet({
  open,
  onClose,
  t,
  onReply,
  onCopy,
  onDelete,
  onSelect = null,
  selectLabel = "",
}: {
  open: boolean;
  onClose: () => void;
  t: Dict;
  onReply: (() => void) | null;
  onCopy: (() => void) | null;
  onDelete: (() => void) | null;
  /** 🆕 R255 — «تحديد» يدخل وضعَ التحديد بهذه الرسالة (على الحاسوب لا ضغطَ مطوَّلاً — فالبابُ هنا) */
  onSelect?: (() => void) | null;
  selectLabel?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} closeLabel={t.closeLabel} variant="bottom" labelledBy="msg-menu-title">
      <p id="msg-menu-title" className="sr-only">
        {t.moreMenuTitle}
      </p>
      <div className="py-3">
        {onReply ? (
          <button type="button" onClick={onReply} className={sheetMenuItem}>
            <Icon name="reply" size={18} className="text-accent" />
            {t.msgReply}
          </button>
        ) : null}
        {onCopy ? (
          <button type="button" onClick={onCopy} className={sheetMenuItem}>
            <Icon name="copy" size={18} className="text-accent" />
            {t.msgCopy}
          </button>
        ) : null}
        {onSelect ? (
          <button type="button" onClick={onSelect} className={sheetMenuItem}>
            <Icon name="check" size={18} className="text-accent" />
            {selectLabel}
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" onClick={onDelete} className={sheetMenuItem}>
            <Icon name="trash" size={18} className="text-[color:var(--error)]" />
            <span className="text-[color:var(--error)]">{t.msgDelete}</span>
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

/** ورقةُ الحذف — نسخةُ `DeleteSheet` في التطبيق: «حذف للجميع» حين يحقّ، و«حذف عندي» دائماً */
export function MsgDeleteSheet({
  open,
  count = 1,
  canAll,
  onMe,
  onAll,
  onClose,
  t,
}: {
  open: boolean;
  /** 🆕 R255 — عددُ المحدَّد («حذف ٣ رسائل») */
  count?: number;
  canAll: boolean;
  onMe: () => void;
  onAll: () => void;
  onClose: () => void;
  t: Dict;
}) {
  return (
    <Sheet open={open} onClose={onClose} closeLabel={t.closeLabel} variant="center" labelledBy="msg-del-title" className="p-5">
      <p id="msg-del-title" className="font-bold text-15 mb-1.5">
        {t.msgDeleteTitle(count)}
      </p>
      {canAll ? <p className="text-xs text-muted leading-relaxed mb-4">{t.msgDeleteForAllHint}</p> : <div className="mb-3" />}
      <div className="flex flex-col gap-2">
        {canAll ? (
          <button type="button" onClick={onAll} className={buttonClass({ variant: "danger", size: "md" })}>
            {t.msgDeleteForAll}
          </button>
        ) : null}
        <button type="button" onClick={onMe} className={buttonClass({ variant: canAll ? "ghost" : "danger", size: "md" })}>
          {t.msgDeleteForMe}
        </button>
        <button type="button" onClick={onClose} className={buttonClass({ variant: "ghost", size: "md" })}>
          {t.cancelLabel}
        </button>
      </div>
    </Sheet>
  );
}

/** 🆕 D-1403 — اقتباسُ الأصل: خطٌّ بلون صاحبه، اسمُه، وأوّلُ سطرٍ أو «📷 صورة»/«GIF» ومصغّرتُها.
 *  🆕 T397 — انتقل من `Inbox.tsx` ليقرأه القروبُ أيضاً؛ و`who` اسمُ صاحب الأصل (في القروب يتغيّر من رسالةٍ لأخرى) */
export function ReplyQuote({ r, onMine, t, who }: { r: NonNullable<ConvReplyEvent["reply"]>; onMine: boolean; t: Dict; who: string }) {
  const name = r.kind === "gone" ? "" : r.mine ? t.convYou : who;
  const line =
    r.kind === "gone" ? t.msgReplyGone : r.kind === "gif" ? t.msgGifPreview : r.kind === "image" ? (r.body ? `${t.msgImagePreview} · ${r.body}` : t.msgImagePreview) : r.body;
  const thumb = r.kind === "image" ? r.image?.url ?? null : r.kind === "gif" && r.gif_id ? gifUrl(r.gif_id, "small") : null;
  return (
    <span className={`flex items-stretch gap-2 overflow-hidden rounded-xl ${onMine ? "bg-black/10" : "bg-white/5"}`}>
      <span className={`w-1 shrink-0 ${r.mine ? (onMine ? "bg-[color:var(--on-accent)]" : "bg-accent") : onMine ? "bg-[color:var(--on-accent)] opacity-50" : "bg-muted"}`} />
      <span className="min-w-0 flex-1 py-1.5 pe-2 text-12 leading-snug">
        {name ? <span className="block font-bold">{name}</span> : null}
        <span className="block truncate opacity-80">{line}</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من مخزنٍ خاصّ أو Giphy */}
      {thumb ? <img src={thumb} alt="" className="h-12 w-12 shrink-0 object-cover" loading="lazy" /> : null}
    </span>
  );
}

/** سطرُ ما يُقتبس فوق الخانة حين يُضغط «رد» — نصُّ الرسالة أو «📷 صورة»/«GIF» */
export function replyLineOf(e: ConvReplyEvent, t: Dict): string {
  if (e.gif_id) return t.msgGifPreview;
  if (e.image) return e.body ? `${t.msgImagePreview} · ${e.body}` : t.msgImagePreview;
  return e.body;
}

/** مختصرُ الأصل للفقاعة المتفائلة — ما سيعيده الخادمُ نفسُه بعد لحظة */
export function replyRefOf(e: ConvReplyEvent): NonNullable<ConvReplyEvent["reply"]> {
  return {
    id: e.id,
    mine: e.mine,
    kind: e.gif_id ? "gif" : e.image ? "image" : "text",
    body: e.body,
    ...(e.image ? { image: e.image } : {}),
    ...(e.gif_id ? { gif_id: e.gif_id } : {}),
  };
}

/** فقاعةٌ واحدة: عملٌ مُشارَك (بطاقة) أو قائمةٌ أو رسالةٌ — نصٌّ أو صورةٌ أو GIF، فوقها اقتباسُها وفي زاويتها وقتُها.
 *  🆕 T397 — انتقلت من `Inbox.tsx` ليرسمها القروبُ بحرفها (كما يفعل التطبيق بـ`asBubbleEvent`)، وزاد الوقتُ والعلامة */
export function ConvBubble({ event, t, quoteWho }: { event: ConvEvent; t: Dict; quoteWho: string }) {
  const meta = <MsgMeta at={event.created_at} tick={tickOf(event)} t={t} onAccent={event.mine && event.kind === "reply"} />;
  const align = event.mine ? "items-end" : "items-start";
  const quote = event.kind === "reply" && event.reply ? <ReplyQuote r={event.reply} onMine={event.mine} t={t} who={quoteWho} /> : null;

  /* 🆕 D-1441 — رسالةٌ حذفها صاحبُها للجميع: سطرٌ خافتٌ مائلٌ بإطارٍ متقطّع مكانَها، لا لونُ صاحبها (لا محتوى بقي) */
  if (event.kind === "reply" && event.deleted) {
    return (
      <div className={`flex flex-col ${align}`}>
        <span className="flex items-center gap-1.5 rounded-2xl border border-dashed border-border px-3.5 py-2 text-13 italic text-muted">
          <Icon name="trash" size={13} />
          {event.mine ? t.msgDeletedMine : t.msgDeleted}
          <span className="ms-1 not-italic">
            <MsgMeta at={event.created_at} tick={null} t={t} onAccent={false} />
          </span>
        </span>
      </div>
    );
  }
  /* 🆕 D-1387 — GIF أو صورةٌ (وتعليقُها تحتها) في إطارٍ بلون صاحبها، كفقاعة النصّ */
  if (event.kind === "reply" && (event.gif_id || event.image)) {
    const src = event.gif_id ? gifUrl(event.gif_id, "small") : event.image?.url ?? null;
    return (
      <div className={`flex flex-col ${align}`}>
        <div className={`max-w-[min(20rem,100%)] rounded-2xl p-[3px] ${event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"}`}>
          {quote ? <div className="p-1">{quote}</div> : null}
          {src ? (
            <a href={event.image?.url ?? src} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من مخزنٍ خاصّ أو Giphy: لا يمرّ بمحسّن الصور */}
              <img src={src} alt={event.gif_id ? "GIF" : t.msgPickImage} loading="lazy" className="block max-w-full max-h-80 rounded-[13px] object-cover" />
            </a>
          ) : null}
          {event.body ? (
            <span className="fs-content block px-3 pt-1.5 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere]">{event.body}</span>
          ) : null}
          <span className="flex justify-end px-2 pt-1 pb-1">{meta}</span>
        </div>
      </div>
    );
  }
  if (event.kind === "reply") {
    return (
      <div className={`flex flex-col ${align}`}>
        <span
          className={`fs-content max-w-full min-w-0 rounded-2xl px-3.5 py-2 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] ${
            event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"
          }`}
        >
          {quote ? <span className="block mb-1.5">{quote}</span> : null}
          {event.body}
          {/* الوقتُ يطفو في آخر سطرٍ إن اتّسع، وإلّا نزل تحته — عُرفُ الواتس */}
          <span className="float-end ms-3 mt-[0.45rem] whitespace-nowrap">{meta}</span>
        </span>
      </div>
    );
  }

  const note = event.note ? (
    <span
      className={`mt-1 fs-content max-w-full min-w-0 rounded-2xl px-3.5 py-2 text-14 leading-relaxed whitespace-pre-line break-words [overflow-wrap:anywhere] ${
        event.mine ? "bg-accent text-[color:var(--on-accent)]" : "bg-surface-2 text-foreground"
      }`}
    >
      {event.note}
    </span>
  ) : null;
  const cardMeta = (
    <span className="mt-0.5 px-1">
      <MsgMeta at={event.created_at} tick={tickOf(event)} t={t} onAccent={false} />
    </span>
  );

  // قائمةٌ مُشارَكة — بطاقةٌ كبطاقة العمل: أيقونةٌ مكان الملصق، والرابط
  // إلى صفحة القائمة الحيّة (الاسم والعدّة لحظة الإرسال، D-048 روحاً)
  if (event.kind === "list") {
    return (
      <div className={`flex flex-col ${align}`}>
        <Link
          href={`/lists/${event.list_id}`}
          prefetch={false}
          className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2 hover:bg-surface-2 transition group w-72 max-w-full"
        >
          <span className="grid place-items-center w-10 shrink-0 aspect-[2/3] rounded-md bg-surface-2 text-muted" aria-hidden>
            <Icon name="list" size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-14 font-semibold truncate group-hover:text-accent transition">{event.list_name ?? "—"}</span>
            <span className="block text-12 text-muted">
              {event.item_count ? `${t.convListBadge} · ${t.personWorksCount(event.item_count)}` : t.convListBadge}
            </span>
          </span>
        </Link>
        {note}
        {cardMeta}
      </div>
    );
  }

  // عملٌ مُشارَك — بطاقةٌ بسطحٍ محايد في الجهتين، مصطفّةٌ حسب المُرسِل
  const poster = posterUrl(event.poster_path, "w185");
  const href = `/${event.media_type === "tv" ? "show" : "movie"}/${event.tmdb_id}`;
  return (
    <div className={`flex flex-col ${align}`}>
      <Link
        href={href}
        prefetch={false}
        className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2 hover:bg-surface-2 transition group w-72 max-w-full"
      >
        <span className="relative block w-10 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2">
          {poster ? (
            <Image src={poster} alt="" fill sizes="40px" className="object-cover" />
          ) : (
            <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
              <Icon name="film" size={13} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-14 font-semibold truncate group-hover:text-accent transition">{event.title ?? "—"}</span>
          <span className="block text-12 text-muted">{event.media_type === "tv" ? t.typeSeries : t.typeMovie}</span>
        </span>
      </Link>
      {note}
      {cardMeta}
    </div>
  );
}
