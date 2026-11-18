"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { PlanPill, badgeLabelsOf } from "../AccountIdentity";
import { buttonClass } from "../ui/Button";
import { segmentedItem, segmentedTrack } from "../ui/controls";
import { v1Get, v1Post } from "../InboxComposer";
import { SUPPORTER_WORDS } from "./supporterWords";
import { flashError } from "@/lib/toast";
import { getDict, num, type Locale } from "@/core/i18n";
import type { SupportersPayload } from "@/core/contracts/supporters";

/**
 * ====== 🆕 «داعمو لوبز» في الويب (T413، اللوحةُ كما رُسمت للحاسوب) ======
 *
 * نظيرُ `apps/mobile/src/settings/SupportersScreen.tsx` بأبوابه نفسِها: `GET /api/v1/supporters` (الظاهرون، الأقدمُ أوّلاً،
 * وحالُك أنت) و`POST /api/v1/me/supporter {hidden}`. كلُّ عضو Gold يظهر تلقائياً، وكلُّ خانةٍ تفتح ملفَّ صاحبها، والترتيبُ
 * «الأقدم | الأحدث» في العميل بالمقسّم الواحد. **وإخفاءُ اسمك من اللوحة يُسقط معه سطرَ «داعم لوبز منذ» من ملفّك** (الهجرة ٢٤٤).
 * 🔑 **على الحاسوب** شبكةٌ من ستّة أعمدة وعمودٌ جانبيٌّ فيه بطاقتُك (Gold) أو «انضم للداعمين» (غيرُه) — إضافةُ الويب الوحيدة،
 * بابٌ إلى صفحة الاشتراك لا بيع. ما دونه عمودٌ واحد: البطاقةُ ثمّ الشبكة.
 */
export function SupportersBoard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const w = SUPPORTER_WORDS[locale === "en" ? "en" : "ar"];
  const labels = badgeLabelsOf(t);
  const [data, setData] = useState<SupportersPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [order, setOrder] = useState<"oldest" | "newest">("oldest");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void v1Get<SupportersPayload>("/api/v1/supporters").then((d) => {
      if (!live) return;
      if (d) setData(d);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const month = (iso: string | null) => {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(ms) ? null : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { month: "long", year: "numeric" }).format(new Date(ms));
  };

  const toggle = async () => {
    if (!data?.me) return;
    const next = !data.me.hidden;
    setBusy(true);
    try {
      await v1Post("/api/v1/me/supporter", { hidden: next }, t);
      const fresh = await v1Get<SupportersPayload>("/api/v1/supporters");
      if (fresh) setData(fresh);
    } catch (e) {
      flashError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <p className="py-16 text-center text-sm text-muted">{w.failed}</p>;
  if (!data) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 desk:grid-cols-6" aria-hidden>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const list = order === "oldest" ? data.list : [...data.list].reverse();
  const n = data.list.length;
  const me = data.me;

  return (
    <div>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold md:text-[30px]">{w.thanks(n, num(n, locale))}</h1>
        <p className="mt-1.5 text-sm text-muted">{w.sub}</p>
      </header>

      <div className="flex flex-col gap-6 desk:flex-row-reverse desk:items-start">
        <aside className="desk:sticky desk:top-6 desk:w-[300px] desk:shrink-0">
          {me?.gold ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-[#d7a531] bg-surface p-4 text-center">
              <p className="flex items-center gap-1.5 text-15 font-bold">
                {w.you}
                <PlanPill tier="gold" t={labels} />
              </p>
              {month(me.since) && <p className="text-12 text-muted">{w.since(month(me.since) as string)}</p>}
              <button
                type="button"
                role="switch"
                aria-checked={!me.hidden}
                aria-label={w.showA11y}
                disabled={busy}
                onClick={() => void toggle()}
                className="mt-1 flex w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-start text-sm disabled:opacity-60"
              >
                <span>{me.hidden ? w.hidden : w.shown}</span>
                <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition ${me.hidden ? "bg-border" : "bg-accent"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[color:var(--background)] shadow transition-all ${me.hidden ? "start-0.5" : "start-[22px]"}`} />
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-bold">{w.joinTitle}</p>
              <p className="mt-1 text-12 leading-relaxed text-muted">{w.joinBody}</p>
              <Link
                href="/plus?tier=gold"
                className={buttonClass({ size: "sm", full: true, className: "mt-3 border-0 bg-gradient-to-br from-[#f7dc7a] to-[#d7a531] text-[#1a1300]" })}
              >
                {w.joinCta}
              </Link>
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div role="tablist" className={segmentedTrack}>
              {(["oldest", "newest"] as const).map((o) => (
                <button key={o} type="button" role="tab" aria-selected={order === o} onClick={() => setOrder(o)} className={segmentedItem(order === o)}>
                  {o === "oldest" ? w.oldest : w.newest}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-12 text-muted">
              <Icon name="people" size={14} />
              {w.note}
            </span>
          </div>
          {list.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">{w.empty}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 desk:grid-cols-6">
              {list.map((s) => (
                <li key={s.username}>
                  <Link
                    href={`/u/${s.username}`}
                    prefetch={false}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-2 py-4 transition hover:border-[#d7a531]"
                  >
                    <Avatar src={s.avatar_url} name={s.name ?? s.username} size={56} posY={s.avatar_pos} />
                    <span className="max-w-full truncate text-sm font-bold" dir="auto">
                      {s.name ?? s.username}
                    </span>
                    <PlanPill tier="gold" t={labels} />
                    {month(s.since) && <span className="text-[11.5px] text-muted">{month(s.since)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
