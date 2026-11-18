"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/core/i18n";
import { DM_IMAGE_MAX_BYTES } from "@/core/contracts/messages";
import { DM_MAX } from "@/core/dmPolicy";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";

/* منتقي الـGIF لا يُرسم إلا بضغطة — يُحمَّل عندها لا مع الصفحة (نمطُ `ChatBgSheet`) */
const GifPicker = dynamic(() => import("./GifPicker").then((m) => m.GifPicker), { ssr: false });

/**
 * ====== 🆕 T397 — خانةُ الكتابة في رسائل الويب: نصٌّ وصورةٌ وGIF وردٌّ على رسالة ======
 *
 * 🔑 **خانةٌ واحدةٌ للخاص والقروب** (القاعدة ٣: لا نسخةَ ثانية): الفرقُ بينهما وجهةُ الإرسال وحدَها، فتأتي من
 * صاحب الخيط في `onSend` — الخاصُّ يرسل بـ`sendDirectMessage`، والقروبُ بـ`POST /api/v1/me/groups/<id>`.
 * 🔑 **الحمولةُ حمولةُ التطبيق حرفاً** (D-1387/D-1403): GIF وحدَه بلا نصّ، أو صورةٌ بتعليقٍ اختياريّ، أو نصّ —
 * ومعها `reply_to` حين يُردّ على رسالة. الصورةُ تُرفع أوّلاً إلى `/api/v1/me/messages/image` ويُرسل مسارُها.
 * 🔑 **Enter يرسل وShift+Enter سطرٌ جديد** كما كان (D-765) — فسلوكُ الإرسال لم يتغيّر على أحد.
 */

export type Outgoing = {
  body: string;
  gif_id?: string | null;
  image_path?: string | null;
  reply_to?: string | null;
  /** رابطٌ محلّيٌّ للصورة — للفقاعة المتفائلة وحدها حتى يصل الخيطُ من الخادم */
  local?: string | null;
};

/** ما يُقتبس فوق الخانة: صاحبُه وأوّلُ سطره ومصغّرتُه */
export type ReplyDraft = { id: string; who: string; line: string; thumb?: string | null };

type Dict = ReturnType<typeof getDict>;

/**
 * ظرفُ `/api/v1` كما يرسله `respond` في `lib/v1.ts`: النجاحُ `{ data, invalidates }` والرفضُ `{ error: { message_key } }`
 * بحالة HTTP غيرِ ٢xx. 🔴 T406 — كانت هذه الدالّةُ تنتظر `{ ok: true }` (شكلَ `Result` داخل الخادم لا على السلك)، فكلُّ كتابةٍ
 * ناجحةٍ قُرئت فشلاً: رفعُ الصورة لم يُعِد مساراً، وإرسالُ القروب والحذفُ والإنشاءُ أظهرت «صار خلل» بعد أن تمّت.
 */
export function readV1<T>(res: Response | null, json: unknown): { ok: true; data: T } | { ok: false; key: string | null } {
  const j = (json ?? null) as { data?: T; error?: { message_key?: string } } | null;
  if (res?.ok && j && "data" in j) return { ok: true, data: j.data as T };
  return { ok: false, key: j?.error?.message_key ?? null };
}

function errText(key: string | null, t: Dict): string {
  return key && typeof (t as Record<string, unknown>)[key] === "string" ? ((t as Record<string, unknown>)[key] as string) : t.apiInternal;
}

/** نداءُ كتابةٍ إلى `/api/v1` بجلسة الكوكي — الرفضُ يعود رسالةً مقروءةً من مفتاحه (`message_key`) لا «تعذّر» عامّ */
export async function v1Post<T = unknown>(path: string, body: unknown, t: Dict): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch(() => null);
  const r = readV1<T>(res, await res?.json().catch(() => null));
  if (r.ok) return r.data;
  throw new Error(errText(r.key, t));
}

/** قراءةٌ من `/api/v1` — `null` عند أيِّ رفض (من يقرأ يعرض فراغاً لا خطأ) */
export async function v1Get<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { cache: "no-store" }).catch(() => null);
  const r = readV1<T>(res, await res?.json().catch(() => null));
  return r.ok ? r.data : null;
}

const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** أطولُ ضلعٍ بعد التصغير — رقمُ التطبيق نفسُه (١٩٢٠) */
const MAX_EDGE = 1920;

/**
 * يرفع صورةَ رسالةٍ ويعيد مسارَها. ما فوق ٣٫٥ ميجابايت أو بنوعٍ لا يقبله المخزن (HEIC من الآيفون مثلاً) يُصغَّر
 * في المتصفّح إلى JPEG بضلعٍ أطول ١٩٢٠ — كما يفعل التطبيقُ قبل الإرسال — فلا يرفض الخادمُ صورةً يقدر المتصفّحُ أن يرسمها.
 */
export async function uploadChatImage(file: File, t: Dict): Promise<string> {
  let blob: Blob = file;
  if (!OK_TYPES.includes(file.type) || file.size > DM_IMAGE_MAX_BYTES * 0.85) {
    blob = await shrink(file).catch(() => {
      throw new Error(t.apiImageInvalid);
    });
  }
  const form = new FormData();
  form.append("file", blob, "image.jpg");
  const res = await fetch("/api/v1/me/messages/image", { method: "POST", body: form, cache: "no-store" }).catch(() => null);
  const r = readV1<{ path: string }>(res, await res?.json().catch(() => null));
  if (r.ok && r.data?.path) return r.data.path;
  throw new Error(errText(r.ok ? null : r.key, t));
}

async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!out) throw new Error("encode");
  return out;
}

export function ChatComposer({
  locale,
  onSend,
  reply,
  onCancelReply,
  placeholder,
}: {
  locale: Locale;
  /** يُنادى بعد رفع الصورة (إن وُجدت) — وصاحبُ الخيط يضيف الفقاعةَ المتفائلة ويرسل */
  onSend: (m: Outgoing) => Promise<void> | void;
  reply: ReplyDraft | null;
  onCancelReply: () => void;
  placeholder?: string;
}) {
  const t = getDict(locale);
  const [value, setValue] = useState("");
  const [pic, setPic] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [gifOpen, setGifOpen] = useState<boolean | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /* النموُّ بعد كلِّ تغيير قيمة — في effect لا في onChange: القياسُ بعد أن يُرسم النصُّ فعلاً (ومنه التصفيرُ بعد الإرسال) */
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  /* الردُّ يعيد التركيزَ إلى الخانة — من ضغط «رد» يريد أن يكتب الآن */
  useEffect(() => {
    if (reply) box.current?.focus();
  }, [reply]);

  /* الرابطُ المحلّيُّ للمعاينة يُحرَّر حين تُستبدل الصورةُ أو تُزال */
  useEffect(() => {
    return () => {
      if (pic) URL.revokeObjectURL(pic.url);
    };
  }, [pic]);

  async function submit() {
    const body = value.trim();
    if (busy || (!body && !pic)) return;
    tap(8);
    const replyTo = reply?.id ?? null;
    if (!pic) {
      setValue("");
      onCancelReply();
      await onSend({ body, reply_to: replyTo });
      return;
    }
    setBusy(true);
    try {
      const path = await uploadChatImage(pic.file, t);
      /* الرابطُ المحلّيُّ يبقى للفقاعة المتفائلة — لا يُحرَّر هنا (المعاينةُ تُنسى دون أن تُبطل رابطَها) */
      const local = URL.createObjectURL(pic.file);
      setPic(null);
      setValue("");
      onCancelReply();
      await onSend({ body, image_path: path, reply_to: replyTo, local });
    } catch (e) {
      flashError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pickGif(id: string) {
    setGifOpen(false);
    tap(8);
    const replyTo = reply?.id ?? null;
    onCancelReply();
    void onSend({ body: "", gif_id: id, reply_to: replyTo });
  }

  const iconBtn =
    "shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 active:scale-95 transition disabled:opacity-40";

  return (
    /* `relative`: منتقي GIF على الحاسوب نافذةٌ صغيرةٌ تقف فوق الخانة (R255 — «ب») */
    <div className="relative">
      {reply ? (
        <div className="mb-2 flex items-stretch gap-2 overflow-hidden rounded-xl bg-surface-2">
          <span className="w-1 shrink-0 bg-accent" />
          <span className="min-w-0 flex-1 py-1.5 text-12 leading-snug">
            <span className="block font-bold text-accent">{reply.who}</span>
            <span className="block truncate text-muted">{reply.line}</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- رابطٌ مؤقّتٌ من مخزنٍ خاصّ أو Giphy */}
          {reply.thumb ? <img src={reply.thumb} alt="" className="h-11 w-11 shrink-0 object-cover" /> : null}
          <button type="button" onClick={onCancelReply} aria-label={t.msgReplyCancel} title={t.msgReplyCancel} className="shrink-0 grid w-9 place-items-center text-muted hover:text-foreground">
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}

      {pic ? (
        <div className="mb-2 flex items-center gap-2">
          <span className="relative block h-16 w-16 overflow-hidden rounded-xl bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- معاينةٌ محلّيّة (blob:) */}
            <img src={pic.url} alt={t.msgPickImage} className="h-full w-full object-cover" />
          </span>
          <button type="button" onClick={() => setPic(null)} disabled={busy} aria-label={t.closeLabel} title={t.closeLabel} className={iconBtn}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : null}

      {/* items-end: الأزرارُ تلزم قاعَ الخانة وهي تنمو */}
      <div className="flex items-end gap-1.5">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (!f.type.startsWith("image/")) {
              flashError(t.apiImageInvalid);
              return;
            }
            setPic({ file: f, url: URL.createObjectURL(f) });
            box.current?.focus();
          }}
        />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} aria-label={t.msgPickImage} title={t.msgPickImage} className={iconBtn}>
          <Icon name="image" size={18} />
        </button>
        <button
          type="button"
          onClick={() => setGifOpen((v) => !v)}
          disabled={busy || !!pic}
          data-gif-toggle
          aria-expanded={!!gifOpen}
          aria-label={t.msgPickGif}
          title={t.msgPickGifSub}
          className={`${iconBtn} text-[11px] font-extrabold tracking-wide`}
        >
          GIF
        </button>
        <textarea
          ref={box}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape" && reply) onCancelReply();
          }}
          placeholder={pic ? t.msgAddNote : placeholder ?? t.shareReplyPlaceholder}
          aria-label={placeholder ?? t.shareReplyPlaceholder}
          maxLength={DM_MAX}
          rows={1}
          className="flex-1 min-w-0 resize-none overflow-y-auto rounded-2xl bg-surface-2 border border-border px-4 py-2 text-base leading-relaxed outline-none focus:border-accent transition"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={(!value.trim() && !pic) || busy}
          aria-label={t.shareReplySend}
          className="shrink-0 px-4 h-9 rounded-full bg-accent text-[color:var(--on-accent)] text-12 font-bold disabled:opacity-40 hover:brightness-110 active:scale-95 transition"
        >
          {busy ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" /> : t.shareReplySend}
        </button>
      </div>
      {gifOpen !== null ? <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={pickGif} locale={locale} variant="pop" /> : null}
    </div>
  );
}
