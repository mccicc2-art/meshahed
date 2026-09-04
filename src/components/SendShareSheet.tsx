"use client";

import { useEffect, useState, useTransition } from "react";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { getDict, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { myMutualFollows, sendShare } from "@/lib/actions";
import type { MediaType } from "@/core/media";
import type { PersonLite } from "@/lib/data";
import { sheetScroll } from "./ui/controls";

/**
 * «أرسِله لـ…» — منتقي صديقٍ من المتابَعين المتبادلين، مع سطرٍ اختياري.
 *
 * لا محادثة تبدأ من فراغ: الإرسال معلَّقٌ بهذا العمل بعينه. والمنتقي لا
 * يعرض إلا المتابَعين المتبادلين (`myMutualFollows`)؛ والقاعدة تردّ ما
 * سواهم حتى لو تحايل عليه أحد (shares.sql). ورقةٌ علوية لأن فيها كتابة —
 * لوحة المفاتيح لا تدفع أعلى الشاشة (نمط ورقة البحث).
 */
export function SendShareSheet({
  tmdbId,
  mediaType,
  title,
  posterPath,
  locale,
  onClose,
}: {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  locale: Locale;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const [people, setPeople] = useState<PersonLite[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    myMutualFollows()
      .then((list) => alive && setPeople(list))
      .catch(() => alive && setPeople([]));
    return () => {
      alive = false;
    };
  }, []);

  function nameOf(p: PersonLite) {
    if (p.hide_name) return t.anonymousUser;
    return p.nickname || p.username || "—";
  }

  function submit() {
    if (!selected || pending) return;
    tap([12, 30]);
    start(async () => {
      try {
        await sendShare({
          recipientId: selected,
          tmdbId,
          mediaType,
          title,
          posterPath,
          note,
        });
        toast(t.shareSentToast, { tone: "success" });
        onClose();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <Sheet
      open
      variant="top"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="send-share-title"
    >
      <SheetHeader
        id="send-share-title"
        title={t.shareSendSheetTitle(title)}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        <p className="text-xs text-muted mt-0.5">{t.shareSendPickHint}</p>
      </SheetHeader>

      <div className={`${sheetScroll} pb-[env(safe-area-inset-bottom)]`}>
        {people === null ? (
          <p className="text-sm text-muted text-center py-8">{t.shareLoadingPeople}</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-muted text-center py-8 px-5">{t.shareNoMutual}</p>
        ) : (
          <ul className="divide-y divide-[color:var(--divider)]">
            {people.map((p) => {
              const on = selected === p.id;
              const name = nameOf(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(on ? null : p.id)}
                    aria-pressed={on}
                    className="w-full flex items-center gap-3 px-5 py-3 text-start hover:bg-surface-2 transition"
                  >
                    <Avatar
                      src={p.hide_name ? null : p.avatar_url}
                      name={name}
                      size={38}
                      alt={t.avatarAlt}
                    />
                    <span className="min-w-0 flex-1">
                      {/* 🆕 **ومن أُرسل إليه يُعرَف كما يُعرَف في كلِّ سطح**
                          (D-773ب): الورقةُ ليست استثناءً من الهويّة. */}
                      <span className="flex items-center min-w-0" style={{ gap: 4 }}>
                        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
                        {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                      </span>
                      {p.username && (
                        <span className="block text-xs text-muted truncate" dir="ltr">
                          @{p.username}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 grid place-items-center w-[22px] h-[22px] rounded-full border-[1.5px] transition ${
                        on
                          ? "bg-accent border-accent text-[color:var(--on-accent)]"
                          : "border-border text-transparent"
                      }`}
                    >
                      <Icon name="check-line" size={14} strokeWidth={2.2} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {people && people.length > 0 && (
          <div className="p-4 space-y-3 border-t border-[color:var(--divider)]">
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
              disabled={!selected || pending}
              className="w-full h-12 rounded-full bg-accent text-[color:var(--on-accent)] font-bold text-15 disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition"
            >
              {t.shareSendButton}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
