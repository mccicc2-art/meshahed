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
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    const clean = name.trim();
    if (!clean) return;
    setError(null);
    start(async () => {
      try {
        await createList(clean);
        setName("");
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
      <div className="flex gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          maxLength={60}
          placeholder={t.listNamePlaceholder}
          className="flex-1 min-w-0 rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-sm outline-none focus:border-accent transition"
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-accent text-[color:var(--on-accent)] font-bold text-sm hover:brightness-110 transition disabled:opacity-50"
        >
          {t.listCreate}
        </button>
      </div>

      {error && <p className="text-xs text-red-300 mb-4">{error}</p>}

      {lists.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listsEmpty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lists.map((l) => (
            <li
              key={l.id}
              className="rounded-2xl border border-border bg-surface overflow-hidden"
            >
              <Link href={`/lists/${l.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-2 transition">
                {/* ثلاثة ملصقات متراكبة كغلاف للقائمة */}
                <span className="relative w-14 h-14 shrink-0">
                  {(l.posters ?? []).slice(0, 3).map((p, i) => {
                    const url = posterUrl(p, "w185");
                    return url ? (
                      <span
                        key={p}
                        className="absolute top-0 w-9 h-14 rounded-md overflow-hidden border border-border bg-surface-2"
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
                  <span className="block text-[11px] text-muted mt-0.5">
                    {t.listCount(l.item_count)}
                    {l.is_public ? ` · ${t.listPublic}` : ""}
                  </span>
                </span>
              </Link>

              <div className="border-t border-border px-3 py-1.5 flex justify-end">
                {confirming === l.id ? (
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-muted">{t.listDeleteConfirm}</span>
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
                    className="text-[11px] text-muted hover:text-red-300 transition"
                  >
                    {t.listDelete}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
