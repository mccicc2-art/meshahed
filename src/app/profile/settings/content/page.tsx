import { redirect } from "next/navigation";
import { getUser, getContentPrefs } from "@/lib/data";
import { getT, getWatchRegion, getTitleMode } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { RegionSwitch } from "@/components/RegionSwitch";
import { TitleModeSection } from "@/components/settings/TitleModeSection";
import {
  ContentPrefsSection,
  ContentPrefsReset,
} from "@/components/settings/ContentPrefsSection";
import { SettingsDoneAction } from "@/components/settings/SettingsDoneAction";

/**
 * تفضيلاتُ المحتوى — **الأنواعُ وبلدُ المشاهدة** (D-462، مواصفةُ أحمد:
 * «انقل Favourite genres وWatch country إلى Content preferences»).
 *
 * **وكانا في مكانين لا يجمعهما معنى**: الأنواعُ في «تعديل الملفّ»
 * والبلدُ في «المظهر» — **وكلاهما يجيب سؤالاً واحداً: ماذا يُعرض عليّ.**
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const region = await getWatchRegion();
  const titleMode = await getTitleMode();
  const contentPrefs = await getContentPrefs();

  return (
    <SettingsPageLayout title={t.setContent} action={<SettingsDoneAction locale={locale} />}>
      {/* 🆕 **عنوانُ الصفحة داخل التمرير لا في الترويسة** (D-557) —
          ⚖️ **وبمقاس بقيّة العناوين لا أكبر** (D-560): كان ٢٤/١٤
          فطغى على الصفحة، **وسلّمُ الإعدادات كلِّه ١٥ · ١٤ · ١٢.** */}
      <header className="px-1 pt-1">
        <h2 className="text-15 font-bold">{t.cpSection}</h2>
        <p className="text-12 text-muted leading-relaxed mt-1">{t.cpHint}</p>
      </header>

      {/* ⚖️ 🆕 **ومنتقي الأنواع القديم سقط من هذه الصفحة** (D-545).

          **ولماذا سقط ولم يبقَ بجانبه:** كان يكتب `favorite_genres`
          **وهو العمودُ نفسُه الذي يكتبه «المحتوى المفضّل» الجديد** —
          **فمنتقيان لعمودٍ واحدٍ في صفحةٍ واحدة**، يفتح المستخدمُ أحدَهما
          فيرى اختيارَه ناقصاً في الآخر. **وبابان لفعلٍ واحد** (القاعدة ٦).
          **والجديدُ أوسع**: خمسةَ عشرَ مفهوماً بدل اثني عشر، وفيه رعبٌ
          ورومانسيٌّ وإثارة — **وهي التي طلبها أحمد بالاسم.**

          ⚠️ **و`ProfileForm` نفسُها لم تُمسّ**: التهيئةُ الأولى
          (`Onboarding`) وبقيّةُ حقولها كما هي — **الذي سقط استدعاءٌ
          واحدٌ بـ`only={["genres"]}` في هذه الصفحة وحدَها.** */}
      <ContentPrefsSection locale={locale} initial={contentPrefs} signedIn />

      {/* 🆕 **«عرض عناوين الأعمال»** (D-544) — **ومكانُه هنا لا في
          «المظهر»**: السؤالُ الذي تجيبه هذه الصفحةُ هو «ماذا يُعرض
          عليّ» (D-462)، **واسمُ العمل محتوًى لا مظهر.** **وقبل بلد
          المشاهدة** لأنه يمسّ كلَّ سطحٍ في التطبيق وذاك يمسّ صفَّ
          المنصّات. */}
      <SettingsSection boxed label={t.titleNamesTitle} hint={t.titleNamesHint}>
        <TitleModeSection locale={locale} initialMode={titleMode} />
      </SettingsSection>

      {/* 🆕 **بلا لوحٍ يلفّها** (D-555): كان القسمان لوحين بحدٍّ وانحناءٍ
          وفي جوفهما بطاقةُ معاينةٍ ومسارُ رقائق — **إطارٌ داخل إطار.** */}
      <RegionSwitch locale={locale} region={region} />

      <ContentPrefsReset locale={locale} />
    </SettingsPageLayout>
  );
}
