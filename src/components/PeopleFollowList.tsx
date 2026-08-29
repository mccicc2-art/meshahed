"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";
import type { PersonLite } from "@/lib/data";
import { AccountBadges, type BadgeLabels } from "./AccountIdentity";

/**
 * 🆕 **صفُّ شخصٍ واحد — شكلٌ واحدٌ لكلِّ قائمةِ ناس** (D-565).
 *
 * **وُلد في ورقة `ProfilePeeks`** ثمّ احتاجته صفحةُ المتابعات —
 * **فخرج إلى مكانٍ يقرؤه الاثنان بدل أن يُنسخ** (القاعدة ٣/D-145).
 *
 * ⚠️ **ومخفي الاسم بلا صفحةٍ تُقصد** (D-011): صفٌّ بلا رابط — **ورابطٌ
 * إلى صفحةٍ لا اسمَ لها ولا وجه بابٌ يُفتح على فراغ.**
 */
export function PersonRowLink({
  person,
  anonymous,
  t,
  onNavigate,
}: {
  person: PersonLite;
  anonymous: string;
  /* 🆕 **القاموسُ لأجل الشارات** (D-773ب) — **اختياريٌّ لجولةٍ واحدة**:
     مستدعياه يمرّرانه اليوم، **ومن لم يمرّره يرى الصفَّ بلا شارةٍ لا
     منكسراً.** (وصفةُ «معاملٌ اختياريٌّ لإصدارٍ واحد» — القاعدة ٢.) */
  t?: BadgeLabels;
  /** تُغلق الورقةَ حين يسكن الصفُّ ورقةً — وتغيب في الصفحة الكاملة */
  onNavigate?: () => void;
}) {
  const name = person.nickname || person.username || anonymous;
  const row = (
    <span className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-surface-2 transition">
      <Avatar src={person.avatar_url} name={name} size={40} alt="" />
      <span className="min-w-0">
        <span className="flex items-center min-w-0 text-14" style={{ gap: 4 }}>
          <span className="min-w-0 truncate font-semibold">{name}</span>
          {t && !person.hide_name ? <AccountBadges profile={person} t={t} /> : null}
        </span>
        {person.username && (
          <span className="block text-12 text-muted truncate" dir="ltr">
            @{person.username}
          </span>
        )}
      </span>
    </span>
  );
  if (!person.username && !person.nickname) return row;
  return (
    <Link href={`/u/${person.username ?? person.id}`} prefetch={false} onClick={onNavigate}>
      {row}
    </Link>
  );
}

/** الهيكلُ العظميّ — نفسُ مقاسِ الصفّ فلا يقفز الشكلُ عند وصول الأسماء */
export function PeopleListSkeleton() {
  return (
    <div className="space-y-2 py-1" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-2 animate-pulse" />
          <div className="h-3.5 w-1/2 rounded bg-surface-2 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
