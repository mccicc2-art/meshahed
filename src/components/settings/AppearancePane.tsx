import { DEFAULT_THEME } from "@/core/themes";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { LanguageRow } from "@/components/settings/LanguageRow";
import { ThemeSection } from "@/components/settings/ThemeSection";
import { FontSizeSection } from "@/components/settings/FontSizeSection";
import { FONT_UI_COOKIE, FONT_CONTENT_COOKIE, sanitizeFontSize } from "@/core/fontPrefs";
import { isPlus } from "@/core/plan";

/**
 * 🆕 R260 — **محتوى «المظهر واللغة» مكوّنٌ واحد** تستدعيه صفحتُه، وتستدعيه صفحةُ الإعدادات على الحاسوب لتملأ لوحتَها الثانية
 * (لا صفحةَ فارغةً بجوار قائمة الأقسام). الحارسُ (`getUser`) عند الصفحة المستدعية.
 *
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
 * ⚠️ **و`ProfileForm` خرجت من هذه الصفحة ثمّ حُذفت**: كانت تُستدعى
 * بـ`only={["theme"]}` **وتجرّ معها زرَّ حفظٍ ورسالةَ نجاحٍ مقيمة**
 * لخيارٍ واحد — **و`ThemeSection` تستدعي الفعلَ نفسَه لحظةَ الضغط.**
 * **وأُبقيت بشيفرتها حينها** (شرطُ «لا تحذف القديم»)، **ثمّ سقطت في
 * D-842 بعد أن قضت جولةً كاملةً بلا قارئ** (D-214).
 */
export async function AppearancePane() {
  const { locale, t } = await getT();
  const p = await getProfile();

  /* حجمُ الخطّ الحاليُّ من الكوكي — هو ما يرسم الصفحةَ فعلاً الآن،
     وقيمةُ الحساب تلحق به عبر `FontPrefsSync` إن اختلفت */
  const cookieStore = await cookies();
  const fsUi = sanitizeFontSize(cookieStore.get(FONT_UI_COOKIE)?.value);
  const fsContent = sanitizeFontSize(cookieStore.get(FONT_CONTENT_COOKIE)?.value);

  const carry = {
    nickname: p?.nickname ?? "",
    bio: p?.bio ?? "",
    avatarUrl: p?.avatar_url ?? null,
    coverUrl: p?.cover_url ?? null,
    coverPos: p?.cover_pos ?? 30,
    avatarPos: p?.avatar_pos ?? 50,
    favoriteGenres: p?.favorite_genres ?? [],
  };
  const theme = p?.theme ?? DEFAULT_THEME.id;

  return (
    <SettingsPageLayout title={t.setAppearance}>
      {/* الجوّال: الصفوفُ التي تُفتح كما كانت — الحجّةُ في رأس الملفّ */}
      <div className="desk:hidden">
        <SettingsGroup>
          <LanguageRow locale={locale} />
          <ThemeSection locale={locale} initialTheme={theme} plus={isPlus(p)} carry={carry} />
          {/* 🗑️ **وقسمُ «لونُك» سقط** (D-848، حكمُ أحمد بلقطةٍ محوَّطة: «ألوان الثيم الإضافيّة هذي احذفها بالكامل»).
              🔑 **والثيمُ يعود مصدرَ اللون الوحيد** — والثيماتُ كلُّها باقيةٌ كما هي. */}
          <FontSizeSection locale={locale} initialUi={fsUi} initialContent={fsContent} />
        </SettingsGroup>
      </div>
      {/* 🆕 R260 — الحاسوب (إعداداتُ اللوحتين، «ب»): الخياراتُ ظاهرةٌ بلا فتح — رقائقُ للّغة والأحجام وشبكةٌ للثيمات */}
      <div className="hidden desk:block space-y-4">
        <LanguageRow locale={locale} layout="block" />
        <ThemeSection locale={locale} initialTheme={theme} plus={isPlus(p)} carry={carry} layout="block" />
        <FontSizeSection locale={locale} initialUi={fsUi} initialContent={fsContent} layout="block" />
      </div>
    </SettingsPageLayout>
  );
}
