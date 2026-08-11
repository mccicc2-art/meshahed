"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { getDict, num, type Locale } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import {
  renameList,
  myMutualFollows,
  sendListShare,
  myCommunitiesList,
  postCommunityMessage,
} from "@/lib/actions";
import type { PersonLite, CommunityLite } from "@/lib/data";
import { sheetScroll } from "./ui/controls";

/**
 * ورقة مشاركة القائمة — داخل التطبيق أولاً، ثم الرابط للخارج.
 *
 * تُفتح من مكانين: قائمة خيارات صفحة القائمة، **وزرّ المشاركة على بطاقة
 * القائمة في صفحة «قوائمي»** (طلب المالك المتكرّر). مكوّنٌ واحد لا نسختان
 * (D-016).
 *
 * ثلاثة مشاهد في ورقةٍ واحدة لا ثلاث أوراق متراكبة: القائمة الرئيسة،
 * ومنتقي الصديق (نمط SendShareSheet نفسه)، ومنتقي المجتمع. التراكب يكسر
 * حبس التركيز ويربك الرجوع؛ التبديل داخل الورقة يبقيهما سليمَين.
 *
 * «أرسِلها لصديق» صفٌّ منظَّم في `list_shares` لا رابطٌ في نصٍّ حر —
 * حفاظاً على D-051 (D-066). و«انشرها في مجتمعي» رسالة غرفةٍ برابط
 * القائمة، والفقاعة تحوّل روابط `loopztv.com/lists/` وحدها إلى روابط.
 *
 * لا تُشارَك قائمةٌ خاصة: رابطها لا يفتحه غير صاحبه (السياسة في SQL)، فزرّها
 * الوحيد يجعلها معلنة أوّلاً ثم ينسخ الرابط — و`onChanged` يُحدّث `isPublic`
 * فتظهر بعدها أزرار المشاركة كلّها.
 */
export function ShareListSheet({
  listId,
  name,
  isPublic,
  locale,
  onClose,
  onChanged,
}: {
  listId: string;
  name: string;
  isPublic: boolean;
  locale: Locale;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = getDict(locale);
  const [view, setView] = useState<"main" | "friend" | "community">("main");
  const [pending, start] = useTransition();
  /* الرابط من الثابت الرسمي لا من النافذة: المثبِّت القديم على
     meshahed.vercel.app كان يوزّع نطاق النشرة لا نطاق العلامة */
  const url = () => siteUrl(`/lists/${listId}`);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      toast(t.linkCopied);
    } catch {
      /* متصفّح بلا حافظة — لا رسالة تفيد هنا */
    }
  }

  async function systemShare() {
    const link = url();
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url: link });
        return;
      }
    } catch {
      return; // أغلق المستخدم ورقة المشاركة — ليس خطأً
    }
    await copy();
  }

  function makePublicThenCopy() {
    tap([12, 30]);
    start(async () => {
      try {
        await renameList(listId, name, true);
        onChanged();
        try {
          await navigator.clipboard.writeText(url());
        } catch {
          /* الحافظة تحتاج إيماءةً في بعض المتصفّحات — الرابط عامٌّ على أي حال */
        }
        toast(t.listMadePublicCopied);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-share-title">
      {/* الترويسة: زرّ رجوعٍ في المشهدين الفرعيين — الورقة واحدة والعنوان ثابت */}
      <div className="relative">
        {view !== "main" && (
          <button
            type="button"
            onClick={() => setView("main")}
            aria-label={t.convBackAria}
            className="absolute start-3 top-4 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
          >
            <Icon name="chevron-down" size={18} className="rotate-90 rtl:-rotate-90" />
          </button>
        )}
        <p id="list-share-title" className="text-center font-bold text-[15px] pt-5 pb-1">
          {view === "friend"
            ? t.listShareToFriend
            : view === "community"
              ? t.listShareToCommunity
              : t.listShareSheetTitle}
        </p>
      </div>

      {view === "main" && (
        <>
          <p className="text-center text-xs text-muted px-6 pb-1 leading-relaxed">
            {isPublic ? t.listSharePublicHint : t.listSharePrivateHint}
          </p>
          <div className="p-4 space-y-2">
            {isPublic ? (
              <>
                {/* داخل التطبيق قبل الخارج: الصديق والمجتمع هما بيت القائمة */}
                <button
                  onClick={() => {
                    tap(6);
                    setView("friend");
                  }}
                  className={buttonClass({ size: "lg", full: true })}
                >
                  {t.listShareToFriend}
                </button>
                <button
                  onClick={() => {
                    tap(6);
                    setView("community");
                  }}
                  className={buttonClass({ variant: "surface", size: "lg", full: true })}
                >
                  {t.listShareToCommunity}
                </button>
                <button
                  onClick={systemShare}
                  className={buttonClass({ variant: "surface", size: "lg", full: true })}
                >
                  {t.listShareLinkBtn}
                </button>
                <button
                  onClick={copy}
                  className={buttonClass({ variant: "surface", size: "lg", full: true })}
                >
                  {t.shareCopyLink}
                </button>
              </>
            ) : (
              <button
                onClick={makePublicThenCopy}
                disabled={pending}
                className={buttonClass({ size: "lg", full: true })}
              >
                {t.listMakePublicShare}
              </button>
            )}
          </div>
        </>
      )}

      {view === "friend" && (
        <FriendPicker listId={listId} locale={locale} onDone={onClose} />
      )}
      {view === "community" && (
        <CommunityPicker listUrl={url()} locale={locale} onDone={onClose} />
      )}
    </Sheet>
  );
}

/** منتقي الصديق — نمط SendShareSheet نفسه: متابَعون متبادلون + سطرٌ اختياري */
function FriendPicker({
  listId,
  locale,
  onDone,
}: {
  listId: string;
  locale: Locale;
  onDone: () => void;
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

  const nameOf = (p: PersonLite) =>
    p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

  function submit() {
    if (!selected || pending) return;
    tap([12, 30]);
    start(async () => {
      try {
        await sendListShare({ recipientId: selected, listId, note });
        toast(t.shareSentToast, { tone: "success" });
        onDone();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className={`${sheetScroll} pb-[env(safe-area-inset-bottom)]`}>
      <p className="text-center text-xs text-muted px-6 pb-1">{t.shareSendPickHint}</p>
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
                    <span className="block text-sm font-semibold truncate">{name}</span>
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
            className="w-full h-12 rounded-full bg-accent text-[color:var(--on-accent)] font-bold text-[15px] disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition"
          >
            {t.shareSendButton}
          </button>
        </div>
      )}
    </div>
  );
}

/** منتقي المجتمع — رسالةُ غرفةٍ برابط القائمة، والفقاعة تحوّله رابطاً داخلياً */
function CommunityPicker({
  listUrl,
  locale,
  onDone,
}: {
  listUrl: string;
  locale: Locale;
  onDone: () => void;
}) {
  const t = getDict(locale);
  const [rooms, setRooms] = useState<CommunityLite[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    myCommunitiesList()
      .then((list) => alive && setRooms(list))
      .catch(() => alive && setRooms([]));
    return () => {
      alive = false;
    };
  }, []);

  function post(id: string) {
    if (pending) return;
    tap([12, 30]);
    start(async () => {
      try {
        await postCommunityMessage(id, listUrl);
        toast(t.listSharePostedToast, { tone: "success" });
        onDone();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className={`${sheetScroll} pb-[env(safe-area-inset-bottom)]`}>
      <p className="text-center text-xs text-muted px-6 pb-1">{t.listSharePickCommunity}</p>
      {rooms === null ? (
        <p className="text-sm text-muted text-center py-8">{t.shareLoadingPeople}</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-muted text-center py-8 px-5">{t.listShareNoCommunities}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--divider)] pb-2">
          {rooms.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => post(c.id)}
                disabled={pending}
                className="w-full flex items-center gap-3 px-5 py-3 text-start hover:bg-surface-2 transition disabled:opacity-50"
              >
                <span
                  className="grid place-items-center w-9 h-9 rounded-full bg-surface-2 text-muted shrink-0"
                  aria-hidden
                >
                  <Icon name="people" size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{c.name}</span>
                  <span className="block text-xs text-muted">
                    {t.commMembers(num(c.member_count, locale))}
                  </span>
                </span>
                <span className="shrink-0 text-muted" aria-hidden>
                  <Icon name="share" size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
