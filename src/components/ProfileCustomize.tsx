"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  DEFAULT_PROFILE_PREFS,
  PROFILE_SECTIONS,
  sanitizeProfilePrefs,
  type ProfilePrefs,
  type ProfileSection,
} from "@/lib/profilePrefs";
import { type IconName } from "./Icon";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { SectionOrderList, ToggleRow } from "./ui/SectionOrderList";

/**
 * تخصيص البروفايل (D-129) — **توأم `HomeCustomize` لا نسخته**.
 *
 * نفس `SectionOrderList` ونفس `ToggleRow` ونفس `updateProfile`؛ الفرق
 * سجلُّ الأقسام وحده (ق٦ من بريف الهوية). ولو أضفنا يوماً قسماً ثالثاً
 * قابلاً للترتيب في مكانٍ ثالث، فالمكوّن جاهزٌ له بلا سطرٍ جديد.
 *
 * **الفرق الجوهري عن شاشة الرئيسية، وهو مكتوبٌ للمستخدم لا لنا:** ما
 * يخفيه هنا يختفي **عن الزائر**. لذلك السطر الشارح يقول ذلك صراحةً
 * ويحيل «الحساب الخاص» إلى قسم الخصوصية — خلطُ الإخراج بالخصوصية أخطر
 * سوء فهمٍ ممكن في هذه الشاشة: من ظنّ أن إخفاء قسمٍ يقفله سيكتشف العكس
 * متأخراً.
 */
export function ProfileCustomize({
  locale,
  nickname,
  avatarUrl,
  genres,
  initial,
}: {
  locale: Locale;
  /** يمرّران كما هما — `updateProfile` يكتب الصفّ كاملاً */
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  initial: unknown;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [prefs, setPrefs] = useState<ProfilePrefs>(() => sanitizeProfilePrefs(initial));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggles: { key: "stats" | "level" | "visits"; label: string }[] = [
    { key: "stats", label: t.custStatsCard },
    { key: "level", label: t.custLevel },
    { key: "visits", label: t.custVisits },
  ];

  const sectionMeta: Record<ProfileSection, { icon: IconName; label: string }> = {
    shows: { icon: "tv", label: t.shortShows },
    movies: { icon: "film", label: t.shortMovies },
    artists: { icon: "people", label: t.shortArtists },
    lists: { icon: "list", label: t.profileListsRail },
    ratings: { icon: "star", label: t.ratingsListTitle },
  };

  function set(next: ProfilePrefs) {
    setSaved(false);
    setPrefs(next);
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateProfile({
          nickname,
          avatarUrl,
          favoriteGenres: genres,
          profilePrefs: prefs,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(t.errSave + (e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted leading-relaxed">{t.custProfileHint}</p>

      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-3">{t.custProfileHeader}</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          {toggles.map(({ key, label }) => (
            <ToggleRow
              key={key}
              label={label}
              checked={prefs[key]}
              onChange={() => set({ ...prefs, [key]: !prefs[key] })}
            />
          ))}
        </div>
      </section>

      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.custProfileOrder}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.custOrderHint}</p>

        <SectionOrderList
          all={PROFILE_SECTIONS}
          picked={prefs.order}
          meta={sectionMeta}
          labels={{ up: t.custMoveUp, down: t.custMoveDown, hide: t.custHide, show: t.custShow }}
          onChange={(order) => set({ ...prefs, order })}
        />

        {/* الفراغ مسموحٌ هنا بخلاف الرئيسية — لكنه يُقال بصوتٍ عالٍ حتى
            لا يظنّ صاحبُه أن الصفحة عطلت */}
        {prefs.order.length === 0 && (
          <p className="text-xs text-muted mt-3">{t.custProfileEmpty}</p>
        )}

        <button
          type="button"
          onClick={() => set({ ...DEFAULT_PROFILE_PREFS })}
          className="mt-3 text-xs text-muted hover:text-foreground transition"
        >
          {t.custReset}
        </button>
      </section>

      {error && <Alert>{error}</Alert>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className={buttonClass()}>
          {pending ? t.saving : t.saveChanges}
        </button>
        {saved && (
          <span role="status" className="text-sm text-[color:var(--success)]">
            {t.savedOk}
          </span>
        )}
      </div>
    </div>
  );
}
