import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { LanguageRow } from "@/components/settings/LanguageRow";
import { ThemeSection } from "@/components/settings/ThemeSection";
import { FontSizeSection } from "@/components/settings/FontSizeSection";
import { FONT_UI_COOKIE, FONT_CONTENT_COOKIE, sanitizeFontSize } from "@/core/fontPrefs";
import { isPlus } from "@/core/plan";

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
 * ⚠️ **و`ProfileForm` خرجت من هذه الصفحة ثمّ حُذفت**: كانت تُستدعى
 * بـ`only={["theme"]}` **وتجرّ معها زرَّ حفظٍ ورسالةَ نجاحٍ مقيمة**
 * لخيارٍ واحد — **و`ThemeSection` تستدعي الفعلَ نفسَه لحظةَ الضغط.**
 * **وأُبقيت بشيفرتها حينها** (شرطُ «لا تحذف القديم»)، **ثمّ سقطت في
 * D-842 بعد أن قضت جولةً كاملةً بلا قارئ** (D-214).
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
          /* 🆕 D-633 — والحكمُ من `lib/plan.ts` وحدَه، لا شرطَ هنا */
          plus={isPlus(p)}
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
        {/* 🗑️ **وقسمُ «لونُك» سقط** (D-848، حكمُ أحمد بلقطةٍ محوَّطة:
            «ألوان الثيم الإضافيّة هذي احذفها بالكامل»).
            🔑 **والثيمُ يعود مصدرَ اللون الوحيد**: **كان لونُ التمييز
            يركب فوق أيِّ ثيمٍ ويعبر إلى زائر ملفّك** (D-825) —
            **فصار للتطبيق مصدران للّون الواحد**، **وثيمٌ لا يملك لونَ
            نفسِه ليس ثيماً.** ⚠️ **والثيماتُ كلُّها باقيةٌ كما هي.** */}
        <FontSizeSection locale={locale} initialUi={fsUi} initialContent={fsContent} />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
