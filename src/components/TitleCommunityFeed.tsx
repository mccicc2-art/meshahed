"use client";

import { useState, type ReactNode } from "react";
import { chipClass, chipRow } from "./ui/controls";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";

export type FeedKind = "review" | "talk" | "news";

export interface FeedItem {
  kind: FeedKind;
  /** **الصفُّ مرسوماً ومفتاحُه عليه** — انظر تعليقَ القائمة أسفلَه */
  node: ReactNode;
}

/**
 * **خطُّ المجتمع في صفحة العمل — قائمةٌ واحدةٌ ورقائقُ تُرشِّحها** (D-398،
 * طلبُ أحمد بصورة: «اجمع الأخبار والنقاش والآراء في مكان واحد»).
 *
 * ================= وما كان قبله: ثلاثةُ تبويبات =================
 *
 * «الأخبار» (D-300) و«التعليقات» و«المجتمع» (D-191) — **ثلاثةُ أعمدةٍ
 * تقول كلُّها «ما الجديد عن هذا العمل؟»**، ومن أراد الجواب مرّ على
 * ثلاثةِ أمكنةٍ ليجمعه بنفسه. **وخمسةُ تبويباتٍ في شريطٍ واحدٍ على هاتف
 * تعني خمسَ كلماتٍ مقصوصة** — كان الشريطُ يقسم العرضَ على خمسة.
 *
 * **فصارت ثلاثةً: الحلقات · معلومات · المجتمع** — والفرقُ في العرض وحدَه
 * يجعل التبويبَ يُقرأ لا يُخمَّن.
 *
 * ================= ولماذا رقائقُ لا تبويباتٌ داخلية =================
 *
 * **الرقاقةُ مرشِّحٌ فوق قائمةٍ قائمة، والتبويبُ عمودٌ ثانٍ** (وصفتا
 * `controls.ts`). **وهذه قائمةٌ واحدةٌ مرتّبةٌ بالزمن** — «الكل» ليست
 * تجميعاً لثلاث قوائم، **هي القائمة**، والثلاثةُ الباقية ترشيحٌ لها.
 * **ورقاقةٌ لصنفٍ لا صفَّ له لا تُرسم** (D-222): من لا نقاشَ في عمله لا
 * يرى رقاقةَ نقاش تكذب عليه بالفراغ.
 *
 * **والترشيحُ إخفاءٌ لا حذف** (نفسُ حجّة `DetailTabs`): كلُّ الصفوف
 * مرسومةٌ على الخادم، **فالتبديلُ فوريٌّ بلا طلبٍ ولا وميض.**
 */
export function TitleCommunityFeed({
  items,
  locale,
}: {
  items: FeedItem[];
  locale: Locale;
}) {
  const t = getDict(locale);
  const [kind, setKind] = useState<FeedKind | "all">("all");

  const has = (k: FeedKind) => items.some((i) => i.kind === k);
  const chips: { key: FeedKind | "all"; label: string }[] = [
    { key: "all", label: t.feedFilterAll },
    ...(has("review") ? [{ key: "review" as const, label: t.tabReviews }] : []),
    ...(has("talk") ? [{ key: "talk" as const, label: t.communityFilterTalks }] : []),
    ...(has("news") ? [{ key: "news" as const, label: t.communityTabNews }] : []),
  ];

  if (!items.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-2xl mb-2" aria-hidden>
          💬
        </p>
        <p className="text-sm text-muted leading-relaxed">{t.communityFeedEmpty}</p>
      </div>
    );
  }

  const shown = kind === "all" ? items : items.filter((i) => i.kind === kind);

  return (
    <div className="mt-3">
      {/* **صفُّ الرقائق يظهر حين يكون هناك ما يُرشَّح** — صنفٌ واحدٌ
          يعني أن «الكل» و«هو» شيءٌ واحد، **ومرشِّحٌ بخيارٍ واحد زينة.** */}
      {chips.length > 2 && (
        <div className={chipRow} role="group" aria-label={t.feedFilterGroup}>
          <div className="flex items-center gap-2 pb-1">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={kind === c.key}
                onClick={() => {
                  tap(8);
                  setKind(c.key);
                }}
                className={chipClass(kind === c.key, "sm")}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-1 divide-y divide-[color:var(--divider)]">
        {/* **ولا غلافَ حول الصفّ**: `first:pt-0` فيه يقيس أوّلَ ابنٍ
            لأبيه — **وغلافٌ لكلِّ صفٍّ يجعل كلَّ صفٍّ أوّلاً** فتنهار
            حشوةُ العمود. **فالمفتاحُ يُركَّب على الصفّ عند صناعته** في
            `TitleCommunityTab`، لا هنا. */}
        {shown.map((i) => i.node)}
      </div>
    </div>
  );
}
