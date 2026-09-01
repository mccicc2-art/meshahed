import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { isPlus, planNameOf, planReasonOf } from "@/lib/plan";
import { SECTIONS } from "@/lib/features";
import { getT } from "@/lib/locale";
import { Icon } from "@/components/Icon";
import { SettingsPageLayout } from "@/components/settings/SettingsPageLayout";
import { SettingsGroup, settingsCardRows } from "@/components/settings/SettingsGroup";
import { SettingsRow } from "@/components/settings/SettingsRow";

/**
 * ⚖️ 🆕 **الاشتراك — صفحةٌ تجيب سؤالَ من فتحها** (D-851، بلاغُ أحمد:
 * «وداخله مو مكتوب بلس أو لا، ولا مميّزات البلس، ولا أيّ كلمة مفيدة»).
 *
 * 🔴 **وكانت صفّين لا يقولان شيئاً**: صفٌّ باسم الصفة («مؤسِّس») وقيمةٍ
 * تقول «الحالية»، **وصفٌّ ثانٍ يحيل إلى صفحةٍ أخرى** — **فمن فتحها
 * ليعرف «هل أنا مشتركٌ ومتى ينتهي وماذا أملك» خرج بلا جوابٍ واحدٍ من
 * الثلاثة.** ⚠️ **والحجّةُ القديمة كانت «لا جدولَ اشتراكاتٍ في
 * القاعدة»** — 🔑 **وهي صحيحةٌ في الفواتير وخاطئةٌ في الحال**:
 * **`profiles.plan` و`plus_until` و`founder` موجودةٌ منذ D-633/D-833**،
 * **والصفحةُ كانت تصمت عن بياناتٍ تملكها.**
 *
 * **فصارت ثلاثَ إجاباتٍ بترتيب السؤال:**
 * **١) نوعُ حسابك** — `Loopz+` أو `Loopz مجّاني`، **وسببُه تحته** إن
 *    كان مؤسِّساً أو شريكاً (D-851: النوعُ أوّلاً والصفةُ ثانياً).
 * **٢) متى ينتهي** — `plus_until` بلغة القارئ، **و«بلا تاريخ انتهاء»
 *    حين يكون فارغاً** (وهو عقدُ `isPlus` بحرفه). 🔑 **وهذه أنفعُ حقيقةٍ
 *    في الصفحة وكانت الوحيدةَ الغائبة تماماً.**
 * **٣) ما الذي يفتحه** — **بنودُ `plus` من سجلِّ الميزات نفسِه**
 *    (`lib/features.ts`) — **ولا قائمةٌ ثانيةٌ تُكتب بيد** فتفترق عن
 *    صفحة البيع عند أوّل ميزة (D-145).
 *
 * ⚠️ **والعنوانُ يتبدّل بالحال لا النصُّ وحدَه**: **«ما يشمله اشتراكك»
 * لمن يملكه، و«ما يفتحه Loopz+» لمن لا يملكه** — **وقائمةُ مزايا تحت
 * عنوان «اشتراكك» لمجّانيٍّ تَعِده بما لا يملك** (D-217).
 *
 * ⚠️ **ولا ثمنَ يُعرض لمشترك** — إعلانُ ما اشتراه (حكمُ D-780 كما هو).
 */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { t, locale } = await getT();
  const profile = await getProfile();
  const plus = isPlus(profile);
  const reason = planReasonOf(profile, t);

  /* **والتاريخُ بلغة القارئ لا بصيغة القاعدة** (عُرفُ «عضو منذ» في
     D-831 حرفاً) — **والفاسدُ يُقرأ غياباً لا شاشةَ خطأ** (D-475). */
  const untilRaw = profile?.plus_until ?? null;
  const untilMs = untilRaw ? Date.parse(untilRaw) : NaN;
  const until = Number.isNaN(untilMs)
    ? null
    : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(untilMs));
  /* **وتاريخٌ مضى مع خطّةٍ ساقطة**: **`isPlus` هي التي تحسب المضيَّ
     عند القراءة** (عقدُها في `lib/plan.ts`) — **فالحكمُ هنا تركيبٌ من
     جوابها لا حسابٌ ثانٍ للوقت.**
     🔴 **ولا `Date.now()` في مكوّن** (قاعدةٌ ملزِمة، وقد أمسكها
     `eslint` في هذه الدفعة نفسِها): **تاريخٌ محفوظٌ مع «لستَ مشتركاً»
     يعني اشتراكاً انقضى** — **ومن لم يشترك قطُّ لا تاريخَ له أصلاً.** */
  const expired = !plus && until !== null;

  /* **بنودُ البلس المشحونةُ وحدَها** — **و«قريباً» لا تُعرض هنا**:
     **قائمةُ ما تملكه ليست موضعَ وعدٍ لم يُبنَ** (D-217/D-063). */
  const unlocks = SECTIONS.flatMap((s) => s.items.filter((i) => i.plus && !i.soon));

  return (
    <SettingsPageLayout title={t.setBilling}>
      {/* ===== ١ · نوعُ حسابك ومدّتُه ===== */}
      <div className={settingsCardRows}>
        <div className="flex items-center gap-3 p-4">
          <Icon name="card" size={20} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-20 font-bold leading-tight" dir="auto">
              {planNameOf(profile, t)}
            </span>
            {reason && (
              <span className="block text-14 font-medium text-accent mt-0.5" dir="auto">
                {reason}
              </span>
            )}
            <span className="block text-12 text-muted mt-1.5" dir="auto">
              {expired
                ? t.subExpired
                : plus
                  ? until
                    ? t.subUntil(until)
                    : t.subNoEnd
                  : t.plusPrice}
            </span>
          </span>
          {plus && (
            <span className="shrink-0 text-12 font-semibold text-muted">
              {t.setPlanActive}
            </span>
          )}
        </div>
      </div>

      {/* ===== ٢ · ما يشمله / ما يفتحه ===== */}
      {unlocks.length > 0 && (
        <SettingsGroup label={plus ? t.plusIncludes : t.subPlusUnlocks}>
          {unlocks.map((f) => (
            <div key={f.en} className="flex items-start gap-3 px-3.5 py-3">
              <Icon
                name={f.icon}
                size={18}
                className={`shrink-0 mt-0.5 ${plus ? "text-accent" : "text-muted"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-15 font-semibold leading-tight" dir="auto">
                  {locale === "en" ? f.en : f.ar}
                </span>
                <span className="block text-12 text-muted leading-snug mt-0.5" dir="auto">
                  {locale === "en" ? f.enBody : f.arBody}
                </span>
              </span>
            </div>
          ))}
        </SettingsGroup>
      )}

      {/* ===== ٣ · البابُ إلى الصفحة الكاملة ===== */}
      <SettingsGroup>
        <SettingsRow
          href="/features"
          icon="sparkle-star"
          title={plus ? t.setViewPlans : t.subUpgrade}
          subtitle={plus ? undefined : t.plusPrice}
        />
      </SettingsGroup>
    </SettingsPageLayout>
  );
}
