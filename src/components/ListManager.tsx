"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import type { UserList } from "@/lib/data";
import { ShareListSheet } from "./ShareListSheet";
import { NewListForm } from "./NewListForm";

/**
 * إدارة القوائم.
 *
 * كل قائمة بطاقةٌ كاملة: ترويسةٌ (الاسم + العدد + سهمُ الدخول) ثم
 * صفُّ ملصقاتٍ أفقيٌّ يُظهر محتواها لمحةً واحدة — البطاقة كلها رابطٌ إلى
 * صفحة القائمة، فالضغط في أي مكانٍ يفتحها. لا زرَّ حذفٍ هنا: التسمية
 * والنوع والترتيب والحذف بابُها الوحيد قائمةُ خيارات صفحة القائمة —
 * «بابٌ واحدٌ لكل فعل» بدل بابين متباعدين.
 *
 * الحدّ لونُ خلفية الثيم لا رماديٌّ ثابت: صلبٌ بلا تدرّج، أسود في الداكن
 * يطابق هوية التطبيق، وفاتحٌ في `daylight` — فلا يكسر الثيم الفاتح.
 */
export function ListManager({ lists, locale }: { lists: UserList[]; locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  /* المشاركة من صفحة القوائم نفسها (طلب المالك): زرٌّ على البطاقة يفتح
     نفس ورقة مشاركة صفحة القائمة — مكوّنٌ واحد لا نسختان */
  const [shareFor, setShareFor] = useState<UserList | null>(null);

  return (
    <div>
      {/* نموذجُ الإنشاء صار مكوّناً مشتركاً (D-177): بابُه الثاني ورقةُ
          أدوات المكتبة، **وتحصينات D-168 لا تُنسخ** */}
      <div className="mb-5">
        <NewListForm locale={locale} />
      </div>

      {lists.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.listsEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {lists.map((l) => {
            const posters = (l.posters ?? [])
              .map((p) => posterUrl(p, "w185"))
              .filter(Boolean) as string[];
            // عدّاد ديناميكي حسب المحتوى الفعلي؛ وقبل تشغيل SQL يسقط إلى العدّ الكلّي
            const hasBreakdown =
              typeof l.shows_count === "number" || typeof l.movies_count === "number";
            const countLine = hasBreakdown
              ? t.listContentCount(l.shows_count ?? 0, l.movies_count ?? 0)
              : t.listCount(l.item_count);
            return (
              <li
                key={l.id}
                className="group max-w-full rounded-2xl border border-[color:var(--background)] bg-surface p-2.5 hover:bg-surface-2 transition"
              >
                {/* ترويسةٌ: الاسم رابطٌ + زرّ مشاركة (زرٌّ حقيقيّ خارج الرابط،
                    فلا عنصرٌ تفاعليّ داخل آخر) + سهم الدخول */}
                <div className="flex items-center gap-1">
                  <Link href={`/lists/${l.id}`} className="min-w-0 flex-1 py-0.5">
                    <span className="block text-[15px] font-bold truncate">{l.name}</span>
                    {countLine && (
                      <span className="block text-[12px] text-muted truncate mt-0.5">
                        {countLine}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShareFor(l)}
                    aria-label={t.listShare}
                    title={t.listShare}
                    className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-accent hover:bg-surface-2 active:scale-95 transition"
                  >
                    <Icon name="share" size={16} />
                  </button>
                  <Link
                    href={`/lists/${l.id}`}
                    aria-label={l.name}
                    className="shrink-0 grid place-items-center w-7 h-7"
                  >
                    {/* سهمٌ أفقيٌّ من chevron الموجود: ينقلب تلقائياً في RTL */}
                    <Icon
                      name="chevron-down"
                      size={16}
                      className="text-muted -rotate-90 rtl:rotate-90"
                    />
                  </Link>
                </div>

                {/* صفُّ الملصقات: رابطٌ إلى القائمة، يمرّر أفقياً عند الفيض */}
                <Link href={`/lists/${l.id}`} className="block">
                  {posters.length > 0 ? (
                    <div className="mt-2 -mx-2.5 px-2.5 scroll-px-2.5 overflow-x-auto overscroll-x-contain snap-x snap-proximity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="flex gap-2 w-max pb-0.5">
                        {posters.map((url, i) => (
                          <span
                            key={i}
                            className="relative shrink-0 snap-start w-16 h-24 rounded-lg overflow-hidden bg-surface-2 border border-[color:var(--background)]"
                          >
                            <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="grid place-items-center w-16 h-24 rounded-lg border border-dashed border-[color:var(--background)] text-muted">
                        <Icon name="list" size={16} />
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {shareFor && (
        <ShareListSheet
          listId={shareFor.id}
          name={shareFor.name}
          isPublic={shareFor.is_public}
          locale={locale}
          onClose={() => setShareFor(null)}
          onChanged={() => {
            // بعد جعلها معلنة: حدّث البطاقة محلياً كي تعرض الورقة أزرار
            // المشاركة، وأنعش الصفحة لتتبدّل الشارة
            setShareFor((s) => (s ? { ...s, is_public: true } : s));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
