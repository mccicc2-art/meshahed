import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { LanguageRow } from "@/components/settings/LanguageRow";
import { ThemeSection } from "@/components/settings/ThemeSection";
import { FontSizeSection } from "@/components/settings/FontSizeSection";
import { FONT_UI_COOKIE, FONT_CONTENT_COOKIE, sanitizeFontSize } from "@/lib/fontPrefs";

/**
 * المظهرُ واللغة — **الثيمُ ولغةُ الواجهة وحجمُ الخطّ** (D-462).
 *
 * 🆕 **وأربعةُ ألواحٍ صارت أربعةَ أقسام** (D-555): كان كلُّ إعدادٍ
 * **لوحاً بحدٍّ وانحناءٍ وحشوٍ داخليّ، وفي جوفه بطاقةٌ أخرى** —
 * **إطارٌ داخل إطار في كلِّ صفّ.** **والآن بطاقةٌ واحدةٌ فيها عنوانُها
 * ثمّ محتواها، بلا جوفٍ ثانٍ.**
 *
 * 🆕 **والإيقاعُ إيقاعُ «تفضيلات المحتوى»** (D-557): **أحمد رسم تلك
 * الصفحةَ ولم يرسم هذه** — **وصفحتان متجاورتان بإيقاعين هما بعينهما
 * الشكوى التي وُلدت هذه الجولةُ منها** («أنماط تحكّم مختلفة لنفس نوع
 * الإعداد»). **فالمرسومُ يحكم غيرَ المرسوم ما دام يجيب السؤالَ
 * نفسَه.**
 *
 * ⚠️ **و`ProfileForm` خرجت من هذه الصفحة ولم تُحذف**: كانت تُستدعى
 * بـ`only={["theme"]}` **وتجرّ معها زرَّ حفظٍ ورسالةَ نجاحٍ مقيمة**
 * لخيارٍ واحد — **و`ThemeSection` تستدعي الفعلَ نفسَه لحظةَ الضغط.**
 * **والمكوّنُ باقٍ بشيفرته** لمن يستدعيه لاحقاً (شرطُ «لا تحذف
 * القديم»).
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const p = await getProfile();

  /* حجمُ الخطّ الحاليُّ من الكوكي — هو ما يرسم الصفحةَ فعلاً الآن،
     وقيمةُ الحساب تلحق به عبر `FontPrefsSync` إن اختلفت */
  const cookieStore = await cookies();
  const fsUi = sanitizeFontSize(cookieStore.get(FONT_UI_COOKIE)?.value);
  const fsContent = sanitizeFontSize(cookieStore.get(FONT_CONTENT_COOKIE)?.value);

  return (
    <SettingsPageLayout title={t.setAppearance}>
      <SettingsGroup>
        <LanguageRow locale={locale} />
        <ThemeSection
          locale={locale}
          initialTheme={p?.theme ?? "amber"}
          carry={{
            nickname: p?.nickname ?? "",
            bio: p?.bio ?? "",
            avatarUrl: p?.avatar_url ?? null,
            coverUrl: p?.cover_url ?? null,
            coverPos: p?.cover_pos ?? 30,
            avatarPos: p?.avatar_pos ?? 50,
            favoriteGenres: p?.favorite_genres ?? [],
          }}
        />
        <FontSizeSection locale={locale} initialUi={fsUi} initialContent={fsContent} />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
