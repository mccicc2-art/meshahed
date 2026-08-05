"use client";

import { useState } from "react";
import { Icon, type IconName } from "./Icon";

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
    <div className="mt-6">
      {/* شريط مقسّم واحد: خانات متساوية داخل كبسولة، والمختار حبّة بارزة —
          أهدأ من ثلاثة أزرار متجاورة بحدود */}
      <div className="sticky top-16 z-10 bg-[color:var(--background)] py-2">
        <div
          role="tablist"
          className="grid gap-1 p-1 rounded-2xl bg-surface border border-border"
          style={{ gridTemplateColumns: `repeat(${available.length}, minmax(0, 1fr))` }}
        >
          {available.map((tab) => {
            const on = tab.key === active;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(tab.key)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-[13px] text-[13px] font-bold transition-colors ${
                  on
                    ? "bg-accent text-[color:var(--on-accent)] shadow-lg shadow-accent/25"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon name={tab.icon} size={15} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {available.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          hidden={tab.key !== active}
          className={`pt-4 ${tab.key === active ? "tab-fade" : ""}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
