"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createList, deleteList } from "@/lib/actions";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import type { UserList } from "@/lib/data";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

/**
 * إدارة القوائم.
 *
 * الحذف يطلب تأكيداً داخل البطاقة لا عبر نافذة المتصفح: نوافذ `confirm`
 * تُجمّد الصفحة وتبدو غريبة عن الواجهة، والتأكيد في مكانه يُري المستخدم
 * أي قائمة على وشك أن تختفي.
 */
export function ListManager({ lists, locale }: { lists: UserList[]; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    const clean = name.trim();
    if (!clean) return;
    setError(null);
    start(async () => {
      try {
        await createList(clean, false, subtitle);
        setName("");
        setSubtitle("");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function remove(id: string) {
    setConfirming(null);
    start(async () => {
      try {
        await deleteList(id);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            maxLength={60}
            placeholder={t.listNamePlaceholder}
            className="flex-1 min-w-0 rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
          />
          <button
            onClick={add}
            disabled={pending || !name.trim()}
            className={buttonClass({ className: "shrink-0" })}
          >
            {t.listCreate}
          </button>
        </div>

        {/* الوصف يظهر بعد أن يبدأ الاسم لا قبله: حقلان فارغان لكل قائمةٍ
            سريعة ضريبةٌ على الحالة الشائعة، وإظهاره عند أول حرفٍ يجعله
            متاحاً لحظة الإنشاء لمن يريده بلا أن يعترض طريق من لا يريده */}
        {name.trim() && (
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            maxLength={120}
            placeholder={t.listSubtitlePlaceholder}
            aria-label={t.listSubtitleLabel}
            className="acc-in mt-2 w-full rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base font-normal text-muted outline-none focus:border-accent focus:text-foreground transition"
          />
        )}
      </div>

      {error && (
        <Alert inline className="mb-4">
          {error}
        </Alert>
      )}

      {lists.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listsEmpty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lists.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-1 rounded-2xl border border-[color:var(--background)] bg-surface p-2.5"
            >
              <Link
                href={`/lists/${l.id}`}
                className="flex items-center gap-3 flex-1 min-w-0 rounded-xl p-1 hover:bg-surface-2 transition"
              >
                {/* ثلاثة ملصقات متراكبة كغلاف للقائمة */}
                <span className="relative w-14 h-14 shrink-0">
                  {(l.posters ?? []).slice(0, 3).map((p, i) => {
                    const url = posterUrl(p, "w185");
                    return url ? (
                      <span
                        key={p}
                        className="absolute top-0 w-9 h-14 rounded-md overflow-hidden border border-[color:var(--background)] bg-surface-2"
                        style={{ insetInlineStart: i * 10, zIndex: 3 - i }}
                      >
                        <Image src={url} alt="" fill sizes="36px" className="object-cover" />
                      </span>
                    ) : null;
                  })}
                  {!(l.posters ?? []).length && (
                    <span className="absolute inset-0 grid place-items-center rounded-md border border-dashed border-border text-muted">
                      <Icon name="list" size={18} />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold truncate">{l.name}</span>
                  {/* الوصف سطرٌ واحدٌ مقصوص هنا لا سطران: البطاقة صفٌّ في
                      شبكةٍ لا صفحة، وارتفاعٌ متفاوت بين البطاقات يكسر الشبكة */}
                  {l.subtitle && (
                    <span className="block text-[12px] font-normal text-muted/90 truncate mt-0.5">
                      {l.subtitle}
                    </span>
                  )}
                  <span className="block text-[11px] text-muted mt-0.5">
                    {t.listCount(l.item_count)}
                    {l.kind === "ranked"
                      ? ` · ${t.listTypeRanked}`
                      : l.kind === "watch_order"
                        ? ` · ${t.listTypeWatch}`
                        : ""}
                    {l.is_public ? ` · ${t.listPublic}` : ""}
                  </span>
                </span>
              </Link>

              {/* الحذف زرٌّ صغير في الصف نفسه لا شريطاً تحته: الشريط كان
                  يضيف سطراً لكل قائمة بلا فائدة، والتأكيد يحلّ محلّه عند الحاجة */}
              {confirming === l.id ? (
                <span className="flex flex-col items-center gap-0.5 shrink-0 px-1">
                  <button
                    onClick={() => remove(l.id)}
                    className="text-[11px] font-bold text-red-300 hover:brightness-125"
                  >
                    {t.listDeleteYes}
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="text-[11px] text-muted hover:text-foreground"
                  >
                    {t.listDeleteNo}
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(l.id)}
                  aria-label={t.listDelete}
                  title={t.listDelete}
                  className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted hover:text-red-300 hover:bg-surface-2 transition"
                >
                  <span className="text-base leading-none">×</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
