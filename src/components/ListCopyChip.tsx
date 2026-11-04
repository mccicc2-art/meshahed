"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyList, renameList } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { chipClass } from "./ui/controls";

/**
 * 🆕 **رقاقةُ «انسخها لقوائمي» في طرف شريط الحال** (أحمد ٤ نوفمبر ٢٠٢٦ — البند ١ · الهجرة ٢٣٣).
 *
 * ⚖️ **الموضعُ والشكلُ حكمُه بالصورة**: في صفِّ ♥ 💬 ★ نفسِه («أ»)، **داخل إطار** — الرقاقةُ نفسُها
 * (`chipClass`، عائلةُ التحكّم القائمة) لا زرٌّ ثالث — **العلامةُ صفراءُ والكتابةُ رماديّة**.
 * ⚖️ **ولماذا لا تحلّ محلَّ ♥**: الحفظُ مرجعٌ حيٌّ يتبع صاحبَه (D-068)، والنسخةُ قائمتي أعدّلها — فعلان.
 *
 * 🔑 **بعد النسخ تُفتح قائمتي الجديدة** وإشعارٌ يقول إنّها خاصّة (٤أ) **وفيه بابُ إعلانها** — فلا يبحث
 * العضوُ عن مفتاح العلانية ليفعل ما جاء يفعله. ونسختي الموجودة تُفتح ولا تُكرَّر (`copy_list`).
 */
export function ListCopyChip({ listId, name, locale }: { listId: string; name: string; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (pending) return;
        tap(12);
        start(async () => {
          try {
            const r = await copyList(listId);
            if (!r.ok) {
              flashError(r.reason === "too_many" ? t.apiListCopyTooMany : t.apiListCopyUnavailable);
              return;
            }
            const id = r.id;
            toast(t.listCopiedToast, {
              tone: "success",
              action: {
                label: t.listCopyPublish,
                run: () => {
                  void renameList(id, name, true)
                    .then(() => router.refresh())
                    .catch((e: Error) => flashError(e.message));
                },
              },
            });
            router.push(`/lists/${id}`);
          } catch (e) {
            flashError((e as Error).message);
          }
        });
      }}
      className={chipClass(false, "md", "ms-auto shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50")}
    >
      <Icon name="copy" size={16} className="text-accent" />
      {t.listCopyBtn}
    </button>
  );
}
