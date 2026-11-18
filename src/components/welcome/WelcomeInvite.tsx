"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/core/i18n";
import type {
  ClaimReferralBody,
  ClaimReferralPayload,
  InviterLite,
  MyReferralPayload,
  ReferralPeoplePayload,
  ReferralPerson,
} from "@/core/contracts/referral";
import { v1Get, v1Post } from "../InboxComposer";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { buttonClass } from "../ui/Button";
import type { SceneWords } from "./sceneWords";

type State =
  | { kind: "none" }
  | { kind: "ask" }
  | { kind: "confirm"; who: InviterLite; by: ClaimReferralBody }
  | { kind: "done"; who: InviterLite | null; gift: boolean };

/**
 * ====== 🆕 T414 — «هل دعاك أحد؟» في الخطوة الأولى من الترحيب العريض (التصميم «ج — بطاقة العضوية») ======
 *
 * 🔑 **منطقُ `InviteCard` في التطبيق حرفاً، بالأبواب نفسِها** (`/api/v1/me/referral` · `…/people`): الخطوةُ الأولى آخرُ موضعٍ
 * تقبل فيه `claim_referral` النسبة (ترفض حساباً تابع عملاً، والأعمالُ تُكتب في آخر ضغطة).
 * ⚖️ **وبلا كودٍ معلَّق**: في الويب يصل الكودُ بكوكي الرابط ويُنسب عند الدخول (`/auth/callback`) — فمن جاء برابطٍ يجد «دعاك فلان»
 * جاهزاً، ومن لم يأتِ به يُسأل ويبحث بالاسم. والنسبةُ تُختم على البطاقة (`onStamp`) — «بدعوة من …».
 * ⚖️ **ليس قفلاً**: «التالي» يمضي بلا جواب، كالتطبيق.
 */
export function WelcomeInvite({
  t,
  w,
  onStamp,
}: {
  t: Dict;
  w: SceneWords;
  onStamp: (who: InviterLite | null) => void;
}) {
  const [state, setState] = useState<State>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ReferralPerson[] | null>(null);

  useEffect(() => {
    let live = true;
    v1Get<MyReferralPayload>("/api/v1/me/referral").then((me) => {
      if (!live || !me) return;
      if (me.eligible) setState({ kind: "ask" });
      else if (me.inviter) {
        setState({ kind: "done", who: me.inviter, gift: false });
        onStamp(me.inviter);
      }
    });
    return () => {
      live = false;
    };
    /* مرّةً عند الظهور — `onStamp` يتجدّد مع كلِّ رسمٍ للأب ولا يغيّر السؤال */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* البحثُ بعد حرفين ونصفِ ثانية — رقما ورقة التطبيق */
  const term = q.trim();
  useEffect(() => {
    if (!search || term.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      v1Get<ReferralPeoplePayload>(`/api/v1/me/referral/people?q=${encodeURIComponent(term)}`).then((r) => {
        if (live) setFound(r?.people ?? []);
      });
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search, term]);

  async function claim(by: ClaimReferralBody) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await v1Post<ClaimReferralPayload>("/api/v1/me/referral", by, t);
      if (out.claimed || out.inviter) {
        setState({ kind: "done", who: out.inviter, gift: out.claimed && out.source === "friend" });
        onStamp(out.inviter);
      } else if (out.reason === "ineligible") setState({ kind: "none" });
      else {
        setState({ kind: "ask" });
        setError(t.refCantPick);
      }
    } catch {
      setError(t.refFailed);
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "none") return null;

  const box =
    "rounded-2xl border border-[#ffd400]/45 bg-[linear-gradient(135deg,rgba(255,212,0,.16),rgba(10,10,10,.72)_65%)] p-4 xl:p-5";

  if (state.kind === "ask")
    return (
      <div className={box}>
        <button
          type="button"
          onClick={() => {
            setSearch((v) => !v);
            setError(null);
          }}
          aria-expanded={search}
          className="w-full flex items-center gap-3 text-start"
        >
          <span className="w-11 h-11 shrink-0 rounded-full grid place-items-center bg-[#ffd400] text-black">
            <Icon name="person-plus" size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-[15px]">{t.refAsk}</span>
            <span className="block text-12 text-white/65 mt-0.5">{t.refAskHint}</span>
          </span>
          <Icon name="chevron-down" size={18} className={`text-white/70 transition ${search ? "rotate-180" : ""}`} />
        </button>
        {search && (
          <div className="mt-3">
            <label className="sr-only" htmlFor="ws-ref-q">
              {t.refSearchLabel}
            </label>
            <input
              id="ws-ref-q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) setFound(null);
              }}
              maxLength={40}
              autoFocus
              placeholder={t.refSearchPlaceholder}
              className="w-full h-11 rounded-xl border border-white/15 bg-black/50 px-3.5 text-[15px] outline-none focus:border-[#ffd400] placeholder:text-white/40"
            />
            {found && found.length === 0 && term.length >= 2 && (
              <p className="text-12 text-white/60 mt-2.5 text-center">{t.refSearchNone}</p>
            )}
            {found && found.length > 0 && term.length >= 2 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/10 bg-black/40">
                {found.slice(0, 6).map((p) => (
                  <li key={p.username}>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch(false);
                        setState({ kind: "confirm", who: p, by: { username: p.username } });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-start hover:bg-white/5"
                    >
                      <Avatar src={p.avatar_url} name={p.name ?? p.username} size={34} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{p.name ?? p.username}</span>
                        <span className="block text-12 text-white/55 truncate" dir="ltr">
                          @{p.username}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {error && <p className="text-12 text-[color:var(--error)] mt-2">{error}</p>}
      </div>
    );

  const who = state.who;
  return (
    <div className={box}>
      <div className="flex items-center gap-3">
        <Avatar src={who?.avatar_url ?? null} name={who?.name ?? who?.username} size={48} className="ring-2 ring-[#ffd400]" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[16px] truncate">
            {state.kind === "confirm"
              ? who?.name
                ? t.refConfirm(who.name)
                : t.refConfirmAnon
              : who?.name
                ? t.refDone(who.name)
                : t.refDoneAnon}
          </p>
          <p className="text-12 text-white/65 mt-0.5 truncate">
            {state.kind === "confirm" ? w.stampHint : who?.username ? <bdi dir="ltr">@{who.username}</bdi> : ""}
          </p>
        </div>
        {state.kind === "done" && (
          <span className="w-7 h-7 shrink-0 rounded-full grid place-items-center bg-[color:var(--success)] text-white">
            <Icon name="check-line" size={15} strokeWidth={2.4} />
          </span>
        )}
      </div>
      {state.kind === "confirm" && (
        <div className="flex gap-2.5 mt-3.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => claim(state.by)}
            className={buttonClass({ size: "md", className: "flex-1" })}
          >
            {t.refYes}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setState({ kind: "ask" });
            }}
            className={buttonClass({ variant: "ghost", size: "md", className: "flex-1 !text-white border border-white/20" })}
          >
            {t.refNo}
          </button>
        </div>
      )}
      {state.kind === "done" && state.gift && <p className="text-12 text-[#ffd400] font-semibold mt-3 leading-relaxed">{t.refDoneGift}</p>}
      {error && <p className="text-12 text-[color:var(--error)] mt-2">{error}</p>}
    </div>
  );
}
