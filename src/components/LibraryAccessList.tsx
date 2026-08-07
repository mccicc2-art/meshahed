"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { buttonClass } from "./ui/Button";
import { myLibraryGrants, myFollowersList, setLibraryGrant } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import type { PersonLite } from "@/lib/data";

/**
 * «من يرى مكتبتي» — قسمٌ في إعدادات الخصوصية (D-070، م٦).
 *
 * «حساب خاص» يحجب عن الجميع (D-061)، وهذا القسم استثناؤه الفرديّ: منحةٌ
 * لشخصٍ تختاره تفتح له ملفّك كما يراه المتابِع — الحارس واحدٌ في SQL
 * (can_view_profile) لا بابَ جانبيّ. نمط «المحظورين» نفسه: تُجلب القائمة
 * عند فتح القسم بفعل خادم، والمنح والسحب تفاؤليّان مع تراجُع (D-007).
 *
 * المنتقي من متابِعيك: هم من طرق بابك أصلاً — ومنحُ غريبٍ تماماً يمرّ من
 * بحث المستخدمين ثم متابعته أولاً، بابٌ واحدٌ معروف لا ثانٍ.
 */
export function LibraryAccessList({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [items, setItems] = useState<PersonLite[] | null>(null);
  const [picker, setPicker] = useState<PersonLite[] | null | "loading">(null);
  const [, start] = useTransition();

  useEffect(() => {
    let alive = true;
    myLibraryGrants()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  const nameOf = (p: PersonLite) =>
    p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";

  function openPicker() {
    tap(8);
    setPicker("loading");
    myFollowersList()
      .then((rows) => setPicker(rows))
      .catch(() => setPicker([]));
  }

  function grant(p: PersonLite) {
    tap([10, 20]);
    setItems((cur) => [p, ...(cur ?? [])]);
    setPicker(null);
    start(async () => {
      try {
        await setLibraryGrant(p.id, true);
        toast(t.libraryGrantedToast, { tone: "success" });
      } catch (e) {
        setItems((cur) => (cur ?? []).filter((x) => x.id !== p.id));
        flashError((e as Error).message);
      }
    });
  }

  function revoke(p: PersonLite) {
    tap(8);
    const prev = items;
    setItems((cur) => (cur ?? []).filter((x) => x.id !== p.id));
    start(async () => {
      try {
        await setLibraryGrant(p.id, false);
        toast(t.libraryRevokedToast, { tone: "info" });
      } catch (e) {
        setItems(prev);
        flashError((e as Error).message);
      }
    });
  }

  const grantedIds = new Set((items ?? []).map((p) => p.id));
  const candidates =
    picker && picker !== "loading" ? picker.filter((p) => !grantedIds.has(p.id)) : [];

  return (
    <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-bold flex-1">{t.libraryAccessTitle}</h2>
        <button
          type="button"
          onClick={openPicker}
          className={buttonClass({ variant: "surface", size: "sm" })}
        >
          + {t.libraryAccessAdd}
        </button>
      </div>
      <p className="text-xs text-muted leading-relaxed mb-3">{t.libraryAccessHint}</p>

      {/* المنتقي — متابِعوك ممّن لم تمنحهم بعد؛ يلتفّ داخل القسم لا ورقة
          فوق ورقة الإعدادات */}
      {picker === "loading" ? (
        <div className="h-12 rounded-xl bg-surface-2 animate-pulse mb-3" />
      ) : picker && candidates.length === 0 ? (
        <p className="text-[13px] text-muted mb-3">{t.libraryAccessNoCandidates}</p>
      ) : picker && candidates.length > 0 ? (
        <ul className="divide-y divide-[color:var(--divider)] border border-border rounded-xl px-3 mb-3 max-h-64 overflow-y-auto">
          {candidates.map((p) => {
            const name = nameOf(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => grant(p)}
                  className="w-full flex items-center gap-3 py-2.5 text-start hover:bg-surface-2 -mx-1 px-1 rounded-lg transition"
                >
                  <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={32} alt="" />
                  <span className="min-w-0 flex-1 text-[14px] font-semibold truncate">{name}</span>
                  <span className="shrink-0 text-accent" aria-hidden>
                    <Icon name="plus" size={15} strokeWidth={2.2} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {items === null ? (
        /* هيكلٌ بهندسة الصفّ الحقيقي (D-046) */
        <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted">{t.libraryAccessEmpty}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--divider)]">
          {items.map((p) => {
            const name = nameOf(p);
            return (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar src={p.hide_name ? null : p.avatar_url} name={name} size={36} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold truncate">{name}</p>
                  {p.username && !p.hide_name && (
                    <p className="text-[12px] text-muted truncate" dir="ltr">
                      @{p.username}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => revoke(p)}
                  className={buttonClass({ variant: "surface", size: "sm" })}
                >
                  {t.libraryRevokeButton}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
