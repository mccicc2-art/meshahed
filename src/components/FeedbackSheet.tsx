"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { segmentedItem, segmentedTrackFull } from "./ui/controls";
import { buttonClass } from "./ui/Button";
import { SettingsRow } from "./settings/SettingsRow";
import { getDict, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { sendFeedback } from "@/lib/feedback";
import { FEEDBACK_MAX, feedbackReady, type FeedbackKind } from "@/core/contracts/feedback";

/**
 * ====== «أرسل مشكلة أو اقتراح» — الويب (D-1499) ======
 *
 * صفُّ الإعدادات وورقتُه معاً: الصفحةُ خادميّة، والورقةُ تحتاج حالة. توأمُ `FeedbackSheet` في التطبيق
 * حرفاً — الورقةُ الواحدة (`ui/Sheet`)، والمقسّمُ الواحد (`segmentedItem`)، والزرُّ من `buttonClass`.
 * يُرسَل النصُّ والنوعُ واسمُ المتصفّح؛ ورقمُ البناء يضيفه الخادم.
 */
export function FeedbackRow({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsRow
        icon="send"
        title={t.fbRow}
        subtitle={t.fbRowSub}
        onClick={() => {
          tap(6);
          setOpen(true);
        }}
      />
      {open ? <FeedbackSheet locale={locale} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** «Chrome · macOS» — يكفي لإعادة المشكلة، ولا يحمل بصمةَ المتصفّح كاملة */
function browserLabel(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} · ${os}` : b;
}

function FeedbackSheet({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const t = getDict(locale);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const ready = feedbackReady(body);

  function submit() {
    if (!ready || pending) return;
    start(async () => {
      try {
        await sendFeedback({ kind, body, platform: "web", device: browserLabel(), screen: "settings" });
        toast(t.fbSent, { tone: "success" });
        onClose();
      } catch (e) {
        flashError(e instanceof Error && e.message.includes("طلبات كثيرة") ? t.fbRateLimited : t.fbFailed);
      }
    });
  }

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="fb-title">
      <SheetHeader id="fb-title" title={t.fbTitle} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="px-5 pt-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
        <div role="tablist" aria-label={t.fbTitle} className={segmentedTrackFull}>
          {(["bug", "idea"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                tap(6);
                setKind(k);
              }}
              className={segmentedItem(kind === k, "flex-1 basis-0 min-w-0")}
            >
              {k === "bug" ? t.fbKindBug : t.fbKindIdea}
            </button>
          ))}
        </div>
        <div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={kind === "bug" ? t.fbPlaceholderBug : t.fbPlaceholderIdea}
            aria-label={t.fbTitle}
            maxLength={FEEDBACK_MAX}
            rows={6}
            autoFocus
            className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 text-base outline-none focus:border-accent transition resize-none"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3 px-0.5 text-12 text-muted">
            <span>{t.fbAuto}</span>
            <span className="tabular-nums" dir="ltr">
              {body.length} / {FEEDBACK_MAX}
            </span>
          </div>
        </div>
        <button type="button" onClick={submit} disabled={!ready || pending} className={buttonClass({ full: true, className: "disabled:opacity-60" })}>
          {t.fbSend}
        </button>
      </div>
    </Sheet>
  );
}
