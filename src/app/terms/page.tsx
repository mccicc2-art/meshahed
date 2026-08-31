import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/locale";
import { FOUNDER_PLUS_UNTIL } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for using Loopz, in plain language.",
};

/**
 * شروط الاستخدام.
 *
 * صفحةٌ عامّة بلا حارس، لنفس سبب صفحة الخصوصية: شاشة موافقة Google تطلب
 * رابطاً يفتحه أي زائر. والنصّ داخل الملف لا في القاموس المشترك.
 */
export default async function TermsPage() {
  const { locale, t } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3">{ar ? "شروط الاستخدام" : "Terms of Use"}</h1>
      <p className="text-xs text-muted mt-1.5" dir="ltr">
        {ar ? "آخر تحديث: ٢٩ أغسطس ٢٠٢٦" : "Last updated: 29 August 2026"}
      </p>

      <div className="mt-7 space-y-7 text-15 leading-relaxed">
        <Block
          title={ar ? "ما هو Loopz" : "What Loopz is"}
          body={
            ar
              ? "Loopz أداةٌ لتتبّع ما تشاهده من مسلسلاتٍ وأفلامٍ وأنمي: تسجّل حلقاتك، وتقيّم، وتبني قوائم، وترى ما يشاهده غيرك. ليست خدمة بثّ ولا تعرض أي محتوى مرئيّ، ولا تستضيف أفلاماً ولا حلقات."
              : "Loopz is a tool for tracking the series, films and anime you watch: mark episodes, rate them, build lists, and see what other people are watching. It is not a streaming service, it plays no video, and it hosts no films or episodes."
          }
        />

        <Block
          title={ar ? "حسابك" : "Your account"}
          body={
            ar
              ? "الدخول عبر Google وحده، وأنت مسؤولٌ عمّا يجري في حسابك. حسابٌ واحدٌ للشخص الواحد، ولا تنتحل شخصية غيرك في اسمك المستعار أو معرّفك أو صورتك."
              : "Sign-in is Google only, and you are responsible for what happens in your account. One account per person, and do not impersonate anyone else in your nickname, username or picture."
          }
        />

        <Block
          title={ar ? "ما تكتبه" : "What you write"}
          body={
            ar
              ? "مراجعاتك وقوائمك وأسماؤها تبقى ملكك. وبنشرها معلنةً تمنحنا إذناً بعرضها داخل Loopz لا غير. ولا يُسمح بما هو غير قانوني أو تحريضيّ أو مضايق، ولا بالمحتوى الجنسي، ولا بالسبام أو الإعلانات، ولا بنشر بيانات أحدٍ الخاصة. ونحتفظ بحقّ إزالة ما يخالف ذلك أو إيقاف الحساب المتكرّر مخالفته."
              : "Your reviews, lists and their names stay yours. Publishing them publicly gives us permission to display them inside Loopz and nowhere else. Not allowed: anything unlawful, harassing or inciting; sexual content; spam or advertising; or posting anyone's private information. We may remove content that breaks these rules and suspend an account that repeatedly does."
          }
        />

        <Block
          title={ar ? "بيانات الأفلام والمسلسلات" : "Film and series data"}
          body={
            ar
              ? "أسماء الأعمال وملصقاتها وأوصافها وتقييماتها العامّة تأتي من TMDB وتخضع لشروطها وحقوق أصحابها. Loopz لا يملكها ولا يدّعي ملكيتها، ودقّتها ليست مضمونةً منّا."
              : "Titles, posters, descriptions and public ratings come from TMDB and remain subject to its terms and to their owners' rights. Loopz neither owns them nor claims to, and we do not guarantee their accuracy."
          }
        />

        <Block
          title={ar ? "الخدمة كما هي" : "The service as it is"}
          body={
            ar
              ? "Loopz يُقدَّم كما هو. نبذل ما نستطيع لإبقائه يعمل وبياناتك سليمة، لكنّا لا نضمن عملاً بلا انقطاع ولا خلوّاً من الأخطاء، ولا نتحمّل مسؤولية ضررٍ غير مباشرٍ ناتجٍ عن الاستخدام. واحتفظ بنسختك من بياناتك المهمّة إن كانت تهمّك."
              : "Loopz is provided as is. We do our best to keep it running and your data intact, but we do not guarantee uninterrupted or error-free service, and we are not liable for indirect damage arising from its use. Keep your own copy of anything that matters to you."
          }
        />

        <Block
          title={ar ? "الإنهاء" : "Ending it"}
          body={
            ar
              ? "تستطيع حذف حسابك متى شئت من الإعدادات. وقد نوقف حساباً يخالف هذه الشروط، أو نوقف الخدمة كلّها بإشعارٍ مسبقٍ معقول."
              : "You can delete your account at any time from Settings. We may suspend an account that breaks these terms, or discontinue the service entirely with reasonable notice."
          }
        />

        {/* 🆕 **بندا الاشتراك والشراكة** (D-795): **صفحةُ بيعٍ بلا شروطٍ
            مكتوبةٍ لا تُفتح لها بوّابةُ دفع** — كلُّ بائعٍ مسجَّلٍ يطلبها،
            **وثمنٌ يُعرض بلا شرطِ تجديدٍ مكتوبٍ وعدٌ ناقص** (D-217).
            🔑 **ولا صفحةَ ثالثةٌ لها**: هذه عائلةُ «الشروط» — **وصفحةٌ
            ثانيةٌ لنفس العائلة تفترق عن أختها عند أوّل تعديل** (القاعدة ٣).
            ⚠️ **والثمنُ من القاموس لا منسوخاً بيد** — وهو الرقمُ نفسُه
            في `/plus` و`/features` وورقة البوّابة وصفِّ الفوترة. */}
        <Block
          title={ar ? "اشتراك Loopz+" : "The Loopz+ subscription"}
          body={
            ar
              ? `Loopz+ اشتراكٌ اختياريّ للثيمات وتنسيق صفحاتك وشارةٍ بجانب اسمك — والمتابعة والقوائم والمجتمع والبحث تبقى مجّانيةً للجميع دائماً. الثمن ${t.plusPrice}، ${t.plusPriceRenew}، ${t.plusPriceLocal}. والاشتراك يُجدَّد تلقائياً في نهاية مدّته ما لم تُلغِه، والإلغاء متاحٌ في أيّ وقتٍ من إعدادات الاشتراك ويسري في نهاية المدّة المدفوعة — فلا تفقد ما دفعت مقابله. ومن سجّل قبل إعلان الاشتراك يحمل صفة «مؤسِّس» دائماً — والصفة لا تنتهي — ومعها Loopz+ بلا مقابلٍ حتى ${FOUNDER_PLUS_UNTIL.ar}. وتجربة Loopz بلا إعلانات للجميع، مشتركين وغير مشتركين. والاشتراك لم يُفتح بعد؛ ولا يُطلب منك دفعٌ حتى تُفتح بوّابته.`
              : `Loopz+ is an optional subscription for themes, shaping your pages and a badge beside your name — tracking, lists, community and search stay free for everyone, always. It costs ${t.plusPrice}, ${t.plusPriceRenew}, ${t.plusPriceLocal}. It renews automatically at the end of each term unless you cancel; cancelling is available any time from subscription settings and takes effect at the end of the paid term, so you never lose what you already paid for. Anyone who joined before subscriptions were announced keeps Founder status permanently — it never expires — with Loopz+ free until ${FOUNDER_PLUS_UNTIL.en}. Loopz carries no advertising for anyone, subscriber or not. Subscriptions are not open yet, and you are never asked to pay until they are.`
          }
        />

        <Block
          title={ar ? "برنامج شركاء Loopz" : "The Loopz Partners programme"}
          body={
            ar
              ? "الشريك يحصل على ٢٥٪ من صافي كلّ دفعةٍ يدفعها مشترِكٌ انضمّ عبر رابط إحالته، طوال السنة الأولى من اشتراك ذلك العضو. و«الصافي» هو ما يصلنا بعد رسوم الدفع والضرائب. وتُعلَّق العمولة إذا ترك الشريك البرنامج أو أُنهيت شراكته، فهي مقابل شراكةٍ قائمةٍ لا حقٌّ دائم. ويحقّ لنا تعديل النسبة للإحالات الجديدة وحدها بإشعارٍ مسبق، أمّا الإحالات القائمة فتبقى بنسبتها المتّفق عليها. ويُمنع الترويج المضلِّل أو الرسائل غير المرغوبة أو الإحالة الذاتية، ومخالفتها تُنهي الشراكة وتُسقط العمولة غير المدفوعة."
              : "A partner earns 25% of the net on every payment made by a subscriber who joined through their referral link, throughout that member's first year. “Net” means what reaches us after payment fees and taxes. The commission is suspended if the partner leaves the programme or the partnership is ended — it is payment for an ongoing partnership, not a permanent right. We may change the rate for new referrals only, with prior notice; existing referrals keep the rate they were agreed at. Misleading promotion, unsolicited messages and self-referral are prohibited, and a breach ends the partnership and forfeits unpaid commission."
          }
        />

        <Block
          title={ar ? "التغييرات والتواصل" : "Changes and contact"}
          body={
            ar
              ? "قد تتغيّر هذه الشروط؛ التغيير الجوهريّ يُحدَّث تاريخه أعلاه ويُعلَن داخل التطبيق. ولأي سؤال:"
              : "These terms may change; a material change updates the date above and is announced inside the app. For any question:"
          }
        />

        <p className="text-15" dir="ltr">
          <a
            href="mailto:alharbiahmed3bd@gmail.com"
            className="text-accent hover:brightness-110 transition"
          >
            alharbiahmed3bd@gmail.com
          </a>
        </p>

        <p className="text-12 pt-4 border-t border-[color:var(--divider)]">
          <Link href="/privacy" className="text-muted hover:text-foreground transition">
            {ar ? "سياسة الخصوصية ←" : "Privacy Policy →"}
          </Link>
        </p>
      </div>
    </article>
  );
}

/** فقرةٌ بعنوان — نفس المقاسات في الصفحتين */
function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-20 font-bold mb-1.5">{title}</h2>
      <p className="text-muted">{body}</p>
    </section>
  );
}
