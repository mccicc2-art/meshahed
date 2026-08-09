"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { buttonClass } from "./ui/Button";
import { SearchSheet } from "./CommunityBar";

/**
 * الحالة الفارغة الموجَّهة لخطّ الأصدقاء (تقييم 9 Aug م٦).
 *
 * الجملة وحدها كانت تشخّص («تابع أشخاصاً…») ولا تداوي: أين أتابعهم؟
 * الزرّ يفتح ورقة البحث نفسها التي يفتحها «+» أعلى الصفحة — الفراغ
 * يشرح نفسه ويحمل أول خطوةٍ للخروج منه في الموضع ذاته.
 */
export function FeedEmptyCta({ locale, text }: { locale: Locale; text?: string }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center space-y-4">
      <p className="text-sm text-muted">{text ?? t.feedEmpty}</p>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass({ size: "sm" })}>
        {t.feedEmptyCta}
      </button>
      {open && <SearchSheet t={t} onClose={() => setOpen(false)} />}
    </div>
  );
}
