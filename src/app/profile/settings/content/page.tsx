import { redirect } from "next/navigation";
import { getUser, getContentPrefs } from "@/lib/data";
import { getT, getWatchRegion, getTitleMode } from "@/lib/locale";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { RegionSwitch } from "@/components/RegionSwitch";
import { TitleModeSection } from "@/components/settings/TitleModeSection";
import { ContentPrefsSection } from "@/components/settings/ContentPrefsSection";

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
    <SettingsPageLayout title={t.setContent}>
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
      <TitleModeSection locale={locale} initialMode={titleMode} />

      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-15 font-bold mb-1">{t.regionSection}</h2>
        <p className="text-12 text-muted leading-relaxed mb-3">{t.regionHint}</p>
        <RegionSwitch locale={locale} region={region} />
      </section>
    </SettingsPageLayout>
  );
}
