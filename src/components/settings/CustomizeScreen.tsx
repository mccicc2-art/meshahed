"use client";

import { useCallback, useRef, useState } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { HomeCustomize } from "../HomeCustomize";
import { ProfileCustomize } from "../ProfileCustomize";
import { chipClass, pillTrack } from "../ui/controls";
import { SettingsPageLayout } from "./SettingsPageLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { type PrefTemplate } from "@/core/prefTemplates";

/**
 * شاشةُ التخصيص — **سطحان لا صفحتان** (D-129)، **وترويستُها تحمل
 * «استعادة»** (D-465، تصميمُ أحمد).
 *
 * **ولماذا صارت مكوّنَ عميلٍ يرسم القالبَ بنفسه**: زرُّ «استعادة» يسكن
 * ترويسةَ الصفحة **وفعلُه في اللوح المفتوح** — **وصفحةُ خادمٍ لا تملك
 * مقبضاً على حالة ابنها.** فاللوحُ يسلّم مقبضَه عند تركيبه، والترويسةُ
 * تستدعيه. **وحين يتبدّل التبويب يُركَّب اللوحُ الآخرُ فيسلّم مقبضَه**،
 * فلا يستعيد زرٌّ لوحاً مغلقاً.
 *
 * ⚠️ **والاستعادةُ لا تكتب في القاعدة**: تُعيد الشاشةَ إلى الافتراضيّ
 * **وتنتظر «حفظ التغييرات»** — **وفعلٌ لا رجعةَ فيه لا يُطلق بضغطةٍ في
 * زاوية.**
 *
 * ================= 🆕 و«استعادة» نزلت من الترويسة (D-555) =================
 *
 * **كانت في الطرف الآخر من العنوان** (D-465) — **بجوار زرِّ الرجوع
 * حيث يقع الإبهامُ وهو يمرّر** — **وهي الفعلُ الوحيدُ في الشاشة الذي
 * يمحو عملَ عشرِ ضغطات.** **وفعلٌ متلفٌ في أعلى الشاشة يُضغط سهواً.**
 * **ومكانُه الآن قاعُ الصفحة في صفٍّ هادئ**، حيث يُقصد قصداً.
 *
 * ⚠️ **ولا يكتب في القاعدة**: يُعيد الشاشةَ إلى الافتراضيّ **وينتظر
 * شريطَ الحفظ** (حجّةُ D-465 قائمةٌ بحرفها).
 *
 * **والمبدِّلُ رقاقتان لا مقسَّم** (تصميمُ أحمد: خانةٌ ممتلئةٌ بالأصفر):
 * **عائلةُ الرقاقة هي شكلُ «المختار ممتلئ» في هذا التطبيق** — والمقسَّمُ
 * خطٌّ سفليٌّ منذ ١٢ أغسطس. **ولا عائلةَ ثالثة** (القاعدة ٦).
 */
export function CustomizeScreen({
  locale,
  nickname,
  avatarUrl,
  genres,
  homePrefs,
  profilePrefs,
  username,
  bio,
  coverUrl,
  coverPos,
  avatarPos,
  counters,
  templates = [],
  plus = false,
}: {
  locale: Locale;
  nickname: string;
  avatarUrl: string | null;
  genres: number[];
  homePrefs?: unknown;
  profilePrefs?: unknown;
  username?: string | null;
  bio?: string | null;
  coverUrl?: string | null;
  coverPos?: number;
  avatarPos?: number;
  counters?: { followers: number; following: number; visits: number };
  /* 🆕 **قوالبُ التخصيص** (D-822) — **تُقرأ مرّةً في الخادم وتمرّ للوحين**:
     **العمودُ واحدٌ وفيه السطحان**، **والمكوّنُ يصفّي سطحَه.** */
  templates?: PrefTemplate[];
  /* 🆕 **الخطّة تمرّ ولا تُقرأ هنا** (D-633): الشاشةُ حاويةٌ، **والحكمُ
     في `lib/plan.ts` والقفلُ في اللوحين** — ولا شرطَ ثالث. */
  plus?: boolean;
}) {
  const t = getDict(locale);
  const [tab, setTab] = useState<"home" | "profile">("home");
  const reset = useRef<(() => void) | null>(null);

  /* مرجعٌ ثابت — **ولو تبدّل في كلِّ رسمةٍ لأُعيد التسجيلُ بلا نهاية** */
  const registerReset = useCallback((fn: () => void) => {
    reset.current = fn;
  }, []);

  return (
    <SettingsPageLayout title={t.custTitle}>
      <div
        role="tablist"
        aria-label={t.custTitle}
        className={pillTrack}
      >
        {(
          [
            { k: "home" as const, label: t.custTabHome },
            { k: "profile" as const, label: t.custTabProfile },
          ]
        ).map(({ k, label }) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={chipClass(tab === k, "md", "flex-1 basis-0 h-10")}
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
          registerReset={registerReset}
          templates={templates}
          plus={plus}
        />
      ) : (
        <ProfileCustomize
          locale={locale}
          nickname={nickname}
          avatarUrl={avatarUrl}
          genres={genres}
          initial={profilePrefs}
          username={username}
          bio={bio}
          coverUrl={coverUrl}
          coverPos={coverPos}
          avatarPos={avatarPos}
          counters={counters}
          registerReset={registerReset}
          templates={templates}
          plus={plus}
        />
      )}

      <SettingsGroup>
        <SettingsRow
          icon="repeat"
          title={t.custResetShort}
          subtitle={t.custResetHint}
          onClick={() => reset.current?.()}
        />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
