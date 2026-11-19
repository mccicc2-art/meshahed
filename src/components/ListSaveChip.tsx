"use client";

import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { chipClass } from "./ui/controls";
import { saveList } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * 🆕 **الحفظُ بعد أن صار القلبُ إعجاباً** (أحمد ١٩ نوفمبر ٢٠٢٦، الهجرة ٢٤٩) — فعلٌ واحدٌ بوجهين:
 *  • `ListSaveChip` — رقاقةُ «احفظ» في صفحة القائمة **في مكان «انسخها لقوائمي»** بعد إزالة النسخ (صورةُ page-B
 *    المعتمدة: الإشارةُ صفراء والكلمةُ رمادية، كرقاقة النسخ التي حلّت محلَّها).
 *  • `ListSaveMark` — الإشارةُ وحدَها في الزاوية السفلى من البطاقة على دائرةٍ داكنة (صورةُ card-B المعتمدة).
 * الحفظُ كما كان: مرجعٌ حيٌّ في `list_saves` يُظهر القائمةَ في محفوظاتك (D-068). تفاؤليٌّ يُراجَع عند الفشل.
 */
function useSave(listId: string, saved: boolean, locale: Locale) {
  const t = getDict(locale);
  const [on, setOn] = useState(saved);
  const [pending, start] = useTransition();
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const next = !on;
    tap(next ? [12, 30] : 8);
    setOn(next);
    start(async () => {
      try {
        await saveList(listId, next);
        toast(next ? t.listSavedToast : t.listUnsavedToast);
      } catch (err) {
        setOn(!next);
        flashError((err as Error).message);
      }
    });
  };
  return { t, on, pending, toggle };
}

/** رقاقةُ الصفحة — **محكومةٌ من صاحبها** لأن حالةَ الحفظ في صفحة القائمة يقرؤها غيرُها (مفتاحُ التشغيل يظهر للمحفوظة) */
export function ListSaveChip({ on, onToggle, locale }: { on: boolean; onToggle: () => void; locale: Locale }) {
  const t = getDict(locale);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t.listUnsaveLabel : t.listSaveBtn}
      onClick={onToggle}
      /* **رقاقةٌ من عائلة التحكّم الواحدة** (`chipClass`) كالتي حلّت محلَّها — لا صنفٌ ثانٍ يُرسم بيد
         (القاعدة ٣) — **وفي طرف الصفّ** (`ms-auto`) كنظيرتها في التطبيق (`marginStart: "auto"`). */
      className={chipClass(false, "md", "ms-auto shrink-0 inline-flex items-center gap-1.5")}
    >
      <Icon name="bookmark" size={16} strokeWidth={2} className={`text-accent ${on ? "fill-current" : ""}`} />
      {on ? t.listSavedBtn : t.listSaveChip}
    </button>
  );
}

/** `bare` — بلا قرصٍ خلفه: داخلَ حبّةٍ لها حدٌّ وسطحٌ (`UniverseSaveRow`) فلا تُرسم دائرةٌ داخل حبّة */
export function ListSaveMark({ listId, saved = false, locale, bare = false }: { listId: string; saved?: boolean; locale: Locale; bare?: boolean }) {
  const { t, on, pending, toggle } = useSave(listId, saved, locale);
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? t.listUnsaveLabel : t.listSaveBtn}
      title={on ? t.listUnsaveLabel : t.listSaveBtn}
      onClick={toggle}
      className={`shrink-0 grid place-items-center w-8 h-8 rounded-full ${bare ? "" : "bg-[color:var(--background)]/80 "}active:scale-90 disabled:opacity-50 transition ${
        on ? "text-accent" : bare ? "text-muted hover:text-accent" : "text-foreground"
      }`}
    >
      <Icon name="bookmark" size={15} strokeWidth={2} className={on ? "fill-current" : ""} />
    </button>
  );
}
