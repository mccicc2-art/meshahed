import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/locale";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Loopz stores, why, and how to get it back or delete it.",
};

/**
 * سياسة الخصوصية.
 *
 * صفحةٌ عامّة بلا حارس: `getUser()` غير مستدعاة هنا عمداً. شاشة موافقة
 * Google تشترط رابطاً يفتحه أي زائر — ولو حرسناها بتسجيل الدخول لسقط
 * التحقّق عند أول فحص، وهي أصلاً وثيقةٌ يقرؤها من لم يسجّل بعد.
 *
 * والنصّ هنا لا في `i18n.ts`: القاموس يُشحن كاملاً إلى المتصفّح في كل
 * صفحة (~١٦ كيلوبايت مضغوطة)، ووثيقتان قانونيتان طويلتان فيه ضريبةٌ على
 * كل شاشةٍ في التطبيق مقابل صفحةٍ تُفتح مرّةً في العمر.
 */
export default async function PrivacyPage() {
  const { locale } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
      <p className="text-xs text-muted mt-1.5" dir="ltr">
        {/* D-155: السياسةُ نفسها تَعِد بتحديث هذا التاريخ عند أي تغييرٍ
            جوهري — **وD-221 أجوهرُ ما وقع**: «الآخرون» في هذه الوثيقة
            كانوا المسجَّلين، وصاروا الإنترنتَ حين فُتحت غرفةُ الكلام
            وصفحاتُ الخيوط للقراءة بلا حساب. **ووعدٌ لم يعد صادقاً أسوأُ
            من وعدٍ لم يُكتب.** */}
        {ar ? "آخر تحديث: ١٤ أغسطس ٢٠٢٦" : "Last updated: 14 August 2026"}
      </p>

      <div className="mt-7 space-y-7 text-[15px] leading-relaxed">
        <Block
          title={ar ? "الخلاصة" : "The short version"}
          body={
            ar
              ? "Loopz يحفظ ما تحتاجه لتتبّع مشاهداتك: حسابك، وما تتابعه، وما شاهدته، وتقييماتك وقوائمك. لا نبيع بياناتك ولا نعرض إعلانات، ولا نشارك شيئاً مع مُعلنين. وما تجعله «معلناً» بيدك أنت وحدك."
              : "Loopz stores what it needs to track what you watch: your account, what you follow, what you have watched, your ratings and your lists. We do not sell your data, we do not show ads, and we share nothing with advertisers. What is public is only ever what you chose to make public."
          }
        />

        <Block
          title={ar ? "ما الذي نحفظه" : "What we store"}
          body={
            ar
              ? "من حساب Google عند الدخول: بريدك الإلكتروني واسمك المعروض وصورتك. ومن استعمالك للتطبيق: الأعمال التي تتابعها، والحلقات التي أشّرت عليها ومتى، وتقييماتك ومراجعاتك، وقوائمك وترتيبها، وإعجاباتك ومتابعاتك للمستخدمين، واسمك المستعار ومعرّفك وصورتك وغلافك وتفضيلات الواجهة (الثيم، اللغة، ترتيب أقسام الرئيسية). كلمة المرور ليست منها: الدخول عبر Google وحده، ولا نرى كلمة مرورك أبداً."
              : "From your Google account at sign-in: your email address, display name and profile picture. From your use of the app: the titles you follow, the episodes you marked and when, your ratings and reviews, your lists and their order, your likes and the people you follow, plus your nickname, username, avatar, cover image and interface preferences (theme, language, home section order). Not your password: sign-in is Google only, and we never see it."
          }
        />

        <Block
          title={ar ? "ما الذي يراه الآخرون" : "What other people can see"}
          body={
            ar
              ? "ملفك الشخصي وتقييماتك ومراجعاتك تظهر في المجتمع باسمك المستعار ومعرّفك وصورتك. و«الآخرون» هنا تعني الإنترنت لا المسجَّلين وحدهم: صفحة الكلام عن أي عمل، وصفحة كل تعليق، وصفحات نشرات Loopz — كلها تُقرأ بلا حساب ويجوز أن تفهرسها محرّكات البحث. أما الكتابة والردّ والإعجاب والإبلاغ فللمسجَّلين وحدهم. وفي الإعدادات خيار «إخفاء الاسم» يُخفي اسمك وصورتك ومعرّفك عن الآخرين ويُخرجك من بحث المستخدمين — وهو مطبَّق في قاعدة البيانات نفسها لا في الواجهة، فلا يمكن الالتفاف عليه. والقائمة لا تُرى إلا إن جعلتها «معلنة» بنفسك، وحينها يفتحها كل من يملك رابطها. بريدك الإلكتروني لا يُعرض لأحد أبداً."
              : "Your profile, ratings and reviews appear in the community with your nickname, username and picture. “Other people” here means the internet, not only signed-in members: the discussion page for any title, the page for each comment, and Loopz bulletin pages are all readable without an account and may be indexed by search engines. Writing, replying, liking and reporting stay for signed-in members only. Settings has a “hide my name” switch that hides your name, picture and username from others and removes you from people search — it is enforced in the database itself, not in the interface, so it cannot be worked around. A list is visible only if you mark it public, and then anyone with the link can open it. Your email address is never shown to anyone."
          }
        />

        <Block
          title={ar ? "من يشغّل الخدمة معنا" : "Who processes data with us"}
          body={
            ar
              ? "Supabase تستضيف قاعدة البيانات وتسجيل الدخول والصور. Vercel تستضيف الموقع وتُسجّل سجلّات طلبات معتادة. Google تُدير تسجيل الدخول. TMDB مصدر بيانات الأفلام والمسلسلات والملصقات — نرسل إليها ما تبحث عنه لا هويتك. ونستعمل Vercel Speed Insights لقياس سرعة الصفحات؛ يرسل أرقام أداءٍ إلى نطاقنا نفسه ولا يضع كوكيز تتبّعٍ ولا يبني ملفاً إعلانياً عنك. لا توجد أي أداة تتبّعٍ إعلانية في Loopz."
              : "Supabase hosts the database, the sign-in and the uploaded images. Vercel hosts the site and keeps ordinary request logs. Google handles sign-in. TMDB supplies film and series data and posters — we send it what you search for, not who you are. We use Vercel Speed Insights to measure page speed; it reports performance numbers to our own domain, sets no tracking cookies and builds no advertising profile. Loopz contains no advertising trackers of any kind."
          }
        />

        <Block
          title={ar ? "الكوكيز" : "Cookies"}
          body={
            ar
              ? "ثلاثة أنواع لا أكثر: كوكي جلسةٍ من Supabase تُبقيك مسجَّلاً، وكوكي لغةٍ وكوكي ثيمٍ حتى تُرسم الصفحة بلغتك وألوانك من أول لحظة. لا كوكيز إعلانية ولا كوكيز طرفٍ ثالثٍ للتتبّع."
              : "Three, and no more: a Supabase session cookie that keeps you signed in, plus a language cookie and a theme cookie so the first paint is already in your language and colours. No advertising cookies, no third-party tracking cookies."
          }
        />

        <Block
          title={ar ? "استيراد مكتبتك" : "Importing your library"}
          body={
            ar
              ? "ملف التصدير الذي ترفعه — من Letterboxd أو Simkl أو TV Time — يُقرأ داخل متصفّحك ولا يُرفع إلى أي خادم. ولا نربط حسابك في أي خدمةٍ أخرى ولا نطلب إذناً منها: ما يغادر جهازك هو أسماء الأعمال فقط لمطابقتها مع TMDB — وحتى هذا لا يحدث حين يحمل التصدير معرّفات TMDB أصلاً، فلا يغادر شيء."
              : "The export file you upload — from Letterboxd, Simkl or TV Time — is read inside your browser and never uploaded to any server. We do not link your account on any other service and we ask no permission from one: all that leaves your device is title names, to match them against TMDB — and not even that when the export already carries TMDB ids, in which case nothing leaves at all."
          }
        />

        <Block
          title={ar ? "حقّك في بياناتك" : "Your data, your call"}
          body={
            ar
              ? "تستطيع تعديل أو حذف أي تقييمٍ أو مراجعةٍ أو قائمةٍ أو متابعةٍ متى شئت من داخل التطبيق. وحذف الحساب من الإعدادات يحذف صفّ تسجيل الدخول نفسه، فيسقط معه كلُّ ما يشير إليه: ملفك ومتابعاتك وحلقاتك وتقييماتك وقوائمك ورسائلك ومشاركاتك وصورك. لا يبقى منك صفٌّ واحد، ولا تحتاج مراسلتنا."
              : "You can edit or delete any rating, review, list or follow from inside the app at any time. Deleting your account from Settings deletes the sign-in record itself, and everything that points at it falls with it: your profile, follows, watched episodes, ratings, lists, messages, posts and images. Not one row of you remains, and you do not need to write to us."
          }
        />

        <Block
          title={ar ? "الأطفال" : "Children"}
          body={
            ar
              ? "Loopz ليس موجّهاً لمن هم دون الثالثة عشرة، ولا نجمع بياناتهم عن قصد."
              : "Loopz is not directed at children under 13, and we do not knowingly collect their data."
          }
        />

        <Block
          title={ar ? "التغييرات والتواصل" : "Changes and contact"}
          body={
            ar
              ? "إن تغيّرت هذه السياسة تغييراً جوهرياً فسنحدّث تاريخها أعلاه ونُعلمك داخل التطبيق. ولأي سؤالٍ أو طلب حذف:"
              : "If this policy changes materially we will update the date above and tell you inside the app. For any question or deletion request:"
          }
        />

        <p className="text-[15px]" dir="ltr">
          <a
            href="mailto:alharbiahmed3bd@gmail.com"
            className="text-accent hover:brightness-110 transition"
          >
            alharbiahmed3bd@gmail.com
          </a>
        </p>

        <p className="text-[11px] text-muted/70 leading-relaxed pt-4 border-t border-[color:var(--divider)]">
          {ar
            ? "هذا المنتج يستخدم واجهة TMDB البرمجية، وهو غير معتمَد ولا موثَّق من TMDB."
            : "This product uses the TMDB API but is not endorsed or certified by TMDB."}
        </p>

        <p className="text-[13px]">
          <Link href="/terms" className="text-muted hover:text-foreground transition">
            {ar ? "شروط الاستخدام ←" : "Terms of Use →"}
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
      <h2 className="text-base font-bold mb-1.5">{title}</h2>
      <p className="text-muted">{body}</p>
    </section>
  );
}
