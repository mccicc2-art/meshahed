"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { HomeCustomize } from "../HomeCustomize";
import { ProfileCustomize } from "../ProfileCustomize";
import { segmentedItem, segmentedTrackFull } from "../ui/controls";

/**
 * مبدّلُ سطحَي التخصيص — **مُخرَجٌ من `SettingsShell` كما هو** (D-462).
 *
 * **ولا منطقَ جديد**: نفسُ المقسّم ونفسُ المكوّنين — **والذي تبدّل أنه
 * صار يسكن صفحةً بدل لوحٍ داخل تبويبات.** (نصُّ حجّة D-129 باقٍ في
 * موضعه: الرئيسيةُ لك والبروفايل لمن يزورك.)
 */
export function CustomizeTabs({
  locale,
  nickname,
  avatarUrl,
  genres,
  homePrefs,
  profilePrefs,
}: {
  locale: Locale;
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  homePrefs?: unknown;
  profilePrefs?: unknown;
}) {
  const t = getDict(locale);
  const [tab, setTab] = useState<"home" | "profile">("home");

  return (
    <div className="space-y-4">
      <div className={segmentedTrackFull}>
        {(
          [
            { k: "home" as const, label: t.custTabHome },
            { k: "profile" as const, label: t.custTabProfile },
          ]
        ).map(({ k, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-selected={tab === k}
            role="tab"
            className={segmentedItem(tab === k, "flex-1 basis-0")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "home" ? (
        <HomeCustomize
          locale={locale}
          nickname={nickname}
          avatarUrl={avatarUrl}
          genres={genres}
          initial={homePrefs}
        />
      ) : (
        <ProfileCustomize
          locale={locale}
          nickname={nickname}
          avatarUrl={avatarUrl}
          genres={genres}
          initial={profilePrefs}
        />
      )}
    </div>
  );
}
