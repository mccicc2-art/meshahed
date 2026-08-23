"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import { settingsCardRows } from "./settings/SettingsGroup";
import { ToggleRow } from "./ui/SectionOrderList";

/**
 * **ثلاثةُ أقسامٍ لا ثمانية** (D-462): اللغةُ إلى «المظهر»، والاسمُ
 * واسمُ المستخدم إلى `EditProfileForm`، والبريدُ والخروجُ إلى صفحتيهما
 * — **وبقي هنا ما يكتب حقولَ الخصوصيّة وحدَه.**
 *
 * ================= 🆕 ثلاثُ بطاقاتٍ صارت بطاقةً (D-555) =================
 *
 * **كان كلُّ مفتاحٍ بطاقةً بحدٍّ وانحناءٍ وعنوانٍ وفقرةِ شرح، وفي جوفها
 * زرٌّ بحدٍّ وانحناءٍ وخلفيّةٍ صفراءَ شفّافةٍ حين يُفتح** — **إطارٌ داخل
 * إطار، ثلاثَ مرّات** — **ثمّ زرُّ حفظٍ في القاع.**
 *
 * ⚠️ **والأهمّ: كان مفتاحاً ثالثاً في التطبيق.** `ToggleRow` مفتاحُ iOS
 * (مسارٌ يتلوّن وقرصٌ ينزلق) **وهو الذي في «الرئيسية والملفّ»**؛ وهذا
 * صندوقٌ يمتلئ بالأصفر وفيه مفتاحٌ مرسومٌ بيدٍ بـ`translateX` حرفيّ.
 * **ومفتاحان لمعنًى واحدٍ في تطبيقٍ واحد بلاغٌ لا خيار** (القاعدة ٣) —
 * **والآن `ToggleRow` وحدَه في السطحين.**
 *
 * ⚠️ **والحفظُ صار لحظيّاً**: **زرُّ حفظٍ لثلاثة مفاتيح** — **ومفتاحٌ
 * يُقلَب ثمّ يُنسى الحفظُ يعني حساباً ظنّ صاحبُه أنه أقفله وهو مفتوح.**
 * **وفي الخصوصيّة خاصّةً، التأخيرُ خطرٌ لا احتكاك.** **والفعلُ نفسُه لم
 * يتبدّل** (`updateProfile` بالحقول الثلاثة معاً) — تبدّلت لحظةُ ندائه.
 *
 * ⚠️ **والحقولُ الثلاثة تُرسَل معاً في كلِّ نداء**: `updateProfile`
 * يكتب الصفَّ — **وإرسالُ واحدٍ منها وحدَه يكتب الآخرَين بقيمتهما
 * الافتراضيّة** (وهي العلّةُ التي أخرجت هذا اللوحَ من صفحة «الحساب»
 * أصلاً).
 */
export type AccountSection = "hideName" | "privateAccount" | "followLists";

export function AccountSettings({
  locale,
  initialNickname,
  avatarUrl,
  genres,
  initialHideName,
  initialIsPrivate = false,
  initialHideFollowLists = false,
  only,
}: {
  /* ⚠️ **يُقبلان ولا يُقرآن — لعمرِ ترقيةٍ واحدة** (D-028) */
  locale: Locale;
  /** يُمرَّر ولا يُعرض — `updateProfile` يكتب `nickname` في كل نداء */
  initialNickname: string;
  avatarUrl: string | null;
  genres: number[];
  initialHideName: boolean;
  /** حسابٌ خاص — المتابعة بطلبٍ يُقبل */
  initialIsPrivate?: boolean;
  initialHideFollowLists?: boolean;
  /** الأقسام المعروضة — الحذف يعني عرض الجميع */
  only?: AccountSection[];
}) {
  const t = getDict(locale);
  const show = (k: AccountSection) => !only || only.includes(k);
  const router = useRouter();
  const [hideName, setHideName] = useState(initialHideName);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [hideFollowLists, setHideFollowLists] = useState(initialHideFollowLists);
  const [pending, start] = useTransition();

  function commit(next: {
    hideName: boolean;
    isPrivate: boolean;
    hideFollowLists: boolean;
  }) {
    const prev = { hideName, isPrivate, hideFollowLists };
    setHideName(next.hideName);
    setIsPrivate(next.isPrivate);
    setHideFollowLists(next.hideFollowLists);
    start(async () => {
      try {
        await updateProfile({
          /* ⚠️ **الاسمُ يُعاد كما جاء ولا يُرسَل اسمُ المستخدم**:
             `updateProfile` يكتب `nickname` دائماً، **و`username`
             غيابُه يعني «اتركه»** — **فصفحةُ خصوصيّةٍ لا تملك الحقلَ لا
             يجوز أن تكتبه** (D-462). */
          nickname: initialNickname,
          avatarUrl,
          favoriteGenres: genres,
          ...next,
        });
        router.refresh();
      } catch {
        /* **الرجوعُ إلى ما كان**: مفتاحُ خصوصيّةٍ يبقى مقلوباً بعد فشلِ
           الكتابة **يقول للمستخدم إن حسابه أُقفل وهو مفتوح.** */
        setHideName(prev.hideName);
        setIsPrivate(prev.isPrivate);
        setHideFollowLists(prev.hideFollowLists);
        toast(t.errSaveShort, { tone: "error" });
      }
    });
  }

  return (
    <div className={`${settingsCardRows} ${pending ? "opacity-70" : ""}`}>
      {/* الخصوصية: إخفاء الاسم في التقييمات والمراجعات */}
      {show("hideName") && (
        <ToggleRow
          icon="eye-off"
          label={t.hideNameSection}
          hint={t.hideNameHint}
          checked={hideName}
          onChange={() => commit({ hideName: !hideName, isPrivate, hideFollowLists })}
        />
      )}

      {/* الحساب الخاص: المتابعة بطلبٍ يُقبل (follow_requests.sql) */}
      {show("privateAccount") && (
        <ToggleRow
          icon="shield"
          label={t.privateSection}
          hint={t.privateHint}
          checked={isPrivate}
          onChange={() => commit({ hideName, isPrivate: !isPrivate, hideFollowLists })}
        />
      )}

      {/* قفل قائمتَي المتابعة (هجرة 43): العددان يبقيان ظاهرين في الملف —
          هما هويةٌ كزر المتابعة — والمقفول هو ورقتا الأسماء لغير صاحبها */}
      {show("followLists") && (
        <ToggleRow
          icon="people"
          label={t.followListsSection}
          hint={t.followListsHint}
          checked={hideFollowLists}
          onChange={() =>
            commit({ hideName, isPrivate, hideFollowLists: !hideFollowLists })
          }
        />
      )}
    </div>
  );
}
