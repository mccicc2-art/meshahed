"use client";

import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { segmentedItem } from "./ui/controls";
import { StickyStuck } from "./ui/StickyStuck";

export interface DetailTab {
  key: string;
  label: string;
  icon: IconName;
  content: React.ReactNode;
}

/**
 * تبويبات صفحة العمل.
 *
 * كانت الصفحة عموداً واحداً: تتبّع، ثم تقييم، ثم ترايلر، ثم منصّات، ثم
 * آراء، ثم الحلقات — من أراد الحلقات مرّ على كل ما قبلها. التبويبات تجعل
 * الصفحة بطول شاشة أو شاشتين مهما كثر المحتوى، وكل قسم على بعد ضغطة.
 *
 * المحتوى يُرسم كله على الخادم ويُخفى بـ CSS لا بالحذف: التبديل فوري بلا
 * طلب، والحلقات المؤشَّرة في تبويب لا تُفقد حالتها عند العودة إليه.
 */
export function DetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const available = tabs.filter((t) => t.content);
  const [active, setActive] = useState(available[0]?.key);
  if (!available.length) return null;

  return (
    /* 🆕 **والإيقاعُ ضاق درجةً** (D-401، طلبُ أحمد: «كمّل تصغير الأشياء
       مثل التصاميم»): `mt-5` لا `mt-6`، وحشوةُ الشريط `py-1.5` لا `py-2`،
       والخانةُ `pt-1.5 pb-2.5` لا `pt-2 pb-3`، واللوحُ `pt-3` لا `pt-4`.
       🆕 **ثم `mt-3` في D-402** — الخطُّ الأحمر الثاني في لقطة أحمد:
       **الشريطُ لا يحتاج فراغاً يفصله عن صفِّ الأزرار**، خطُّه السفليّ
       يفصله وحدَه.
       **٢٠px تُشترى من فوق كلِّ لوحٍ في التطبيق** — والشريطُ نفسُه لم
       يتغيّر شكلُه، **ضاق فحسب.** */
    <div className="mt-3">
      {/* شريط مقسّم واحد: خانات متساوية فوق خطٍّ فاصلٍ سفليّ، والمختار
          عليه خطٌّ بلون التمييز — أخفّ من كبسولةٍ بحدّ. والأسهم تنقل بين
          التبويبات (مقلوبةً في RTL) كما يتوقّع مستخدم لوحة المفاتيح وقارئ
          الشاشة */}
      {/* `--sticky-top` لا `--header-h` وحده: الترويسة تحمل شريط الحالة
          في وضع التثبيت، فالالتصاق عليه وحده يُدخل الشريط تحتها */}
      {/* 🔴 🆕 **و`chrome-sub` سقطت** (D-598، بلاغُ أحمد بلقطة: الشريطُ
          طافٍ فوق الهيرو يقطع الملصقَ والعنوان): **هذا شريطٌ يجلس في
          وسط الصفحة** — تحت الهيرو وصفِّ الأزرار — **و`chrome-sub`
          ترفع غيرَ الملتصقِ بارتفاعه ومرساتِه** فيقفز مئةَ بكسلٍ فوق
          موضعه. **وهو عطلُ D-564 بحرفه على صفحةٍ ثانية، وعلاجُه
          علاجُها**: `StickyStuck` يقيس الالتصاقَ ولا يفترضه، وطبقتُه
          تسدّ شقَّ الترويسة المنزوية **وهو ملتصقٌ فعلاً وحدَه** (D-570). */}
      <StickyStuck className="relative sticky top-[var(--sticky-top)] z-10 bg-[color:var(--background)] py-1.5">
        <div
          role="tablist"
          className="grid border-b border-[color:var(--divider)]"
          style={{ gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))` }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const rtl = document.documentElement.dir === "rtl";
            const fwd = e.key === (rtl ? "ArrowLeft" : "ArrowRight");
            const idx = available.findIndex((x) => x.key === active);
            const next =
              available[(idx + (fwd ? 1 : -1) + available.length) % available.length];
            setActive(next.key);
            (
              e.currentTarget.querySelector(
                `#tab-${next.key}`,
              ) as HTMLButtonElement | null
            )?.focus();
          }}
        >
          {available.map((tab) => {
            const on = tab.key === active;
            return (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                role="tab"
                aria-selected={on}
                aria-controls={`panel-${tab.key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(tab.key)}
                className={segmentedItem(
                  on,
                  "flex items-center justify-center gap-1.5 px-2 pt-1.5 pb-2.5 text-14",
                  false,
                )}
              >
                <Icon
                  name={tab.icon}
                  size={16}
                  className={`transition-colors ${on ? "text-accent" : ""}`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </StickyStuck>

      {available.map((tab) => (
        <div
          key={tab.key}
          id={`panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== active}
          className={`pt-3 ${tab.key === active ? "tab-fade" : ""}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
