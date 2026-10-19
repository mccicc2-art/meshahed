import { getDict, type Locale } from "./i18n";
import { FOUNDER_PLUS_UNTIL } from "./plan";

/**
 * ====== الوثيقتان القانونيّتان نصّاً لا JSX — مصدرٌ واحدٌ لثلاثة قرّاء (شريحةُ «لا ويب في التطبيق» ٢، ١٩ أكتوبر ٢٠٢٦) ======
 *
 * 🔑 **قرارُ أحمد «شاشة تقرأ من الخادم»**: الصفحتان `/privacy` و`/terms` (والنسختان العاريتان `/app/…` — D-1345) تُرسمان
 * من هنا، و`GET /api/v1/legal/[doc]` يعيد الشيءَ نفسَه للتطبيق فيرسمه أصليّاً. **نسختان من وثيقةٍ قانونيّةٍ تفترقان
 * يومَ تُعدَّل إحداهما** — فلا نسخةَ ثانية: تعديلُ فقرةٍ هنا يصل الموقعَ والتطبيقَ معاً بلا تحديثٍ للتطبيق.
 *
 * ⚖️ **نُقل النصُّ آليّاً من المكوّنين حرفاً** (سكربتٌ لا يدٌ)، بتعليقاته؛ والمكوّنان صارا رسماً فقط. والنصُّ ما زال
 * خارج القاموس للحجّة نفسِها: القاموسُ يُشحن كاملاً إلى المتصفّح، وهذا الملفُّ لا يُستورد إلّا من صفحتيه ومساره.
 *
 * `deleteLink`: الفقرةُ التي يتبعها رابطُ «خطوات حذف الحساب» في الموقع (D-907 — Google Play يطلب رابطاً مخصّصاً).
 */
export type LegalDocName = "privacy" | "terms";
export type LegalSection = { title: string; body: string; deleteLink?: true };
export type LegalDoc = { title: string; updated: string; sections: LegalSection[]; contact: string; note: string | null };

export const LEGAL_CONTACT = "alharbiahmed3bd@gmail.com";

export function privacyDoc(locale: Locale): LegalDoc {
  const ar = locale === "ar";
  return {
    title: ar ? "سياسة الخصوصية" : "Privacy Policy",
  /* D-155: السياسةُ نفسها تَعِد بتحديث هذا التاريخ عند أي تغييرٍ
  جوهري — **وD-221 أجوهرُ ما وقع**: «الآخرون» في هذه الوثيقة
  كانوا المسجَّلين، وصاروا الإنترنتَ حين فُتحت غرفةُ الكلام
  وصفحاتُ الخيوط للقراءة بلا حساب. **ووعدٌ لم يعد صادقاً أسوأُ
  من وعدٍ لم يُكتب.**
  D-1268: والبحثُ بالوصف طرفٌ جديدٌ يستلم نصّاً من المستخدم
  (Gemini، المفتاحُ على الخطّة المجّانيّة فيجوز لـGoogle أن تستعمل
  النصّ) — فذُكر في «من يشغّل الخدمة معنا» وتقدّم التاريخ. إن
  انتقل المفتاحُ إلى خطّةٍ مدفوعة فالجملةُ الأخيرةُ هناك تُحذف. */
  /* D-1305: إشعاراتُ الجهاز — معرّفٌ جديدٌ يُحفظ (رمزُ الدفع) وطرفان يمرّ بهما (Expo · FCM)، فتقدّم التاريخ */

    updated: ar ? "آخر تحديث: ٦ أكتوبر ٢٠٢٦" : "Last updated: 6 October 2026",
    sections: [
      { title: ar ? "الخلاصة" : "The short version",
        body: ar
        ? "Loopz يحفظ ما تحتاجه لتتبّع مشاهداتك: حسابك، وما تتابعه، وما شاهدته، وتقييماتك وقوائمك. لا نبيع بياناتك ولا نعرض إعلانات، ولا نشارك شيئاً مع مُعلنين. وما تجعله «معلناً» بيدك أنت وحدك."
        : "Loopz stores what it needs to track what you watch: your account, what you follow, what you have watched, your ratings and your lists. We do not sell your data, we do not show ads, and we share nothing with advertisers. What is public is only ever what you chose to make public." },
      { title: ar ? "ما الذي نحفظه" : "What we store",
        body: ar
        ? "من حساب Google عند الدخول: بريدك الإلكتروني واسمك المعروض وصورتك. ومن استعمالك للتطبيق: الأعمال التي تتابعها، والحلقات التي أشّرت عليها ومتى، وتقييماتك ومراجعاتك، وقوائمك وترتيبها، وإعجاباتك ومتابعاتك للمستخدمين، واسمك المستعار ومعرّفك وصورتك وغلافك وتفضيلات الواجهة (الثيم، اللغة، ترتيب أقسام الرئيسية). كلمة المرور ليست منها: الدخول عبر Google وحده، ولا نرى كلمة مرورك أبداً."
        : "From your Google account at sign-in: your email address, display name and profile picture. From your use of the app: the titles you follow, the episodes you marked and when, your ratings and reviews, your lists and their order, your likes and the people you follow, plus your nickname, username, avatar, cover image and interface preferences (theme, language, home section order). Not your password: sign-in is Google only, and we never see it." },
      { title: ar ? "ما الذي يراه الآخرون" : "What other people can see",
        body: ar
        ? "ملفك الشخصي وتقييماتك ومراجعاتك تظهر في المجتمع باسمك المستعار ومعرّفك وصورتك. و«الآخرون» هنا تعني الإنترنت لا المسجَّلين وحدهم: صفحة الكلام عن أي عمل، وصفحة كل تعليق، وصفحات نشرات Loopz — كلها تُقرأ بلا حساب ويجوز أن تفهرسها محرّكات البحث. أما الكتابة والردّ والإعجاب والإبلاغ فللمسجَّلين وحدهم. وفي الإعدادات خيار «إخفاء الاسم» يُخفي اسمك وصورتك ومعرّفك عن الآخرين ويُخرجك من بحث المستخدمين — وهو مطبَّق في قاعدة البيانات نفسها لا في الواجهة، فلا يمكن الالتفاف عليه. والقائمة لا تُرى إلا إن جعلتها «معلنة» بنفسك، وحينها يفتحها كل من يملك رابطها. بريدك الإلكتروني لا يُعرض لأحد أبداً."
        : "Your profile, ratings and reviews appear in the community with your nickname, username and picture. “Other people” here means the internet, not only signed-in members: the discussion page for any title, the page for each comment, and Loopz bulletin pages are all readable without an account and may be indexed by search engines. Writing, replying, liking and reporting stay for signed-in members only. Settings has a “hide my name” switch that hides your name, picture and username from others and removes you from people search — it is enforced in the database itself, not in the interface, so it cannot be worked around. A list is visible only if you mark it public, and then anyone with the link can open it. Your email address is never shown to anyone." },
      { title: ar ? "من يشغّل الخدمة معنا" : "Who processes data with us",
        body: ar
        ? "Supabase تستضيف قاعدة البيانات وتسجيل الدخول والصور. Vercel تستضيف الموقع وتُسجّل سجلّات طلبات معتادة. Google تُدير تسجيل الدخول. TMDB مصدر بيانات الأفلام والمسلسلات والملصقات — نرسل إليها ما تبحث عنه لا هويتك. ونستعمل Vercel Speed Insights لقياس سرعة الصفحات؛ يرسل أرقام أداءٍ إلى نطاقنا نفسه ولا يضع كوكيز تتبّعٍ ولا يبني ملفاً إعلانياً عنك. لا توجد أي أداة تتبّعٍ إعلانية في Loopz. البحث بالوصف يستعمل Gemini من Google: نرسل إليه ما كتبته وعناوين من مكتبتك وتقييماتك ليقترح أعمالاً، بلا اسمك ولا بريدك. وقد تستعمل Google هذا النصّ لتحسين خدماتها."
        : "Supabase hosts the database, the sign-in and the uploaded images. Vercel hosts the site and keeps ordinary request logs. Google handles sign-in. TMDB supplies film and series data and posters — we send it what you search for, not who you are. We use Vercel Speed Insights to measure page speed; it reports performance numbers to our own domain, sets no tracking cookies and builds no advertising profile. Loopz contains no advertising trackers of any kind. Search by description uses Google's Gemini: we send it what you typed and titles from your library and ratings so it can suggest works, without your name or email. Google may use that text to improve its services." },
    /* D-1305 — نصٌّ أقرّه أحمد (٦ أكتوبر). يصدق من نسخة التطبيق 1.12.2؛ قبلها لا رمزَ يُحفظ أصلاً */

      { title: ar ? "إشعارات الجهاز" : "Device notifications",
        body: ar
        ? "إن سمحت بالإشعارات في تطبيق أندرويد نحفظ معرّف إشعارات جهازك ولغته لنرسل لك تنبيهات نشاط حسابك: رسالة، متابعة، ردّ أو إعجاب، وحلقة جديدة من مسلسل تتابعه. تمرّ عبر خدمتي Expo و Firebase Cloud Messaging من Google، ويصلهما نصُّ التنبيه ومعرّف الجهاز لا بريدك. يُحذف المعرّف عند تسجيل الخروج أو حذف الحساب، وتستطيع إيقاف أيّ نوعٍ من الإعدادات ← الإشعارات، أو إيقافها كلّها من إعدادات الجهاز."
        : "If you allow notifications in the Android app, we store your device's notification identifier and its language so we can alert you to activity on your account: a message, a follow, a reply or a like, and a new episode of a show you follow. They travel through Expo and Google's Firebase Cloud Messaging, which receive the alert text and the device identifier, not your email. The identifier is deleted when you sign out or delete your account, and you can switch off any kind in Settings → Notifications, or all of them in your device settings." },
      { title: ar ? "الكوكيز" : "Cookies",
        body: ar
        ? "ثلاثة أنواع لا أكثر: كوكي جلسةٍ من Supabase تُبقيك مسجَّلاً، وكوكي لغةٍ وكوكي ثيمٍ حتى تُرسم الصفحة بلغتك وألوانك من أول لحظة. لا كوكيز إعلانية ولا كوكيز طرفٍ ثالثٍ للتتبّع."
        : "Three, and no more: a Supabase session cookie that keeps you signed in, plus a language cookie and a theme cookie so the first paint is already in your language and colours. No advertising cookies, no third-party tracking cookies." },
      { title: ar ? "استيراد مكتبتك" : "Importing your library",
        body: ar
        ? "ملف التصدير الذي ترفعه — من Letterboxd أو Simkl أو TV Time — يُقرأ داخل متصفّحك ولا يُرفع إلى أي خادم. ولا نربط حسابك في أي خدمةٍ أخرى ولا نطلب إذناً منها: ما يغادر جهازك هو أسماء الأعمال فقط لمطابقتها مع TMDB — وحتى هذا لا يحدث حين يحمل التصدير معرّفات TMDB أصلاً، فلا يغادر شيء."
        : "The export file you upload — from Letterboxd, Simkl or TV Time — is read inside your browser and never uploaded to any server. We do not link your account on any other service and we ask no permission from one: all that leaves your device is title names, to match them against TMDB — and not even that when the export already carries TMDB ids, in which case nothing leaves at all." },
      { deleteLink: true, title: ar ? "حقّك في بياناتك" : "Your data, your call",
        body: ar
        ? "تستطيع تعديل أو حذف أي تقييمٍ أو مراجعةٍ أو قائمةٍ أو متابعةٍ متى شئت من داخل التطبيق. وحذف الحساب من الإعدادات يحذف صفّ تسجيل الدخول نفسه، فيسقط معه كلُّ ما يشير إليه: ملفك ومتابعاتك وحلقاتك وتقييماتك وقوائمك ورسائلك ومشاركاتك وصورك. لا يبقى منك صفٌّ واحد، ولا تحتاج مراسلتنا."
        : "You can edit or delete any rating, review, list or follow from inside the app at any time. Deleting your account from Settings deletes the sign-in record itself, and everything that points at it falls with it: your profile, follows, watched episodes, ratings, lists, messages, posts and images. Not one row of you remains, and you do not need to write to us." },
    /* D-907: بيانُ «أمان البيانات» في Google Play يطلب رابطاً مخصّصاً
    لخطوات الحذف — الصفحةُ تشرح الخطوات ومدّة الاحتفاظ، والفقرةُ
    أعلاه تبقى الوعدَ القانونيّ. */



      { title: ar ? "الأطفال" : "Children",
        body: ar
        ? "Loopz ليس موجّهاً لمن هم دون الثالثة عشرة، ولا نجمع بياناتهم عن قصد."
        : "Loopz is not directed at children under 13, and we do not knowingly collect their data." },
      { title: ar ? "التغييرات والتواصل" : "Changes and contact",
        body: ar
        ? "إن تغيّرت هذه السياسة تغييراً جوهرياً فسنحدّث تاريخها أعلاه ونُعلمك داخل التطبيق. ولأي سؤالٍ أو طلب حذف:"
        : "If this policy changes materially we will update the date above and tell you inside the app. For any question or deletion request:" },

    ],
    contact: LEGAL_CONTACT,
    note: ar
      ? "هذا المنتج يستخدم واجهة TMDB البرمجية، وهو غير معتمَد ولا موثَّق من TMDB."
      : "This product uses the TMDB API but is not endorsed or certified by TMDB.",
  };
}

export function termsDoc(locale: Locale): LegalDoc {
  const ar = locale === "ar";
  const t = getDict(locale);
  return {
    title: ar ? "شروط الاستخدام" : "Terms of Use",
    updated: ar ? "آخر تحديث: ٢٩ أغسطس ٢٠٢٦" : "Last updated: 29 August 2026",
    sections: [
      { title: ar ? "ما هو Loopz" : "What Loopz is",
        body: ar
        ? "Loopz أداةٌ لتتبّع ما تشاهده من مسلسلاتٍ وأفلامٍ وأنمي: تسجّل حلقاتك، وتقيّم، وتبني قوائم، وترى ما يشاهده غيرك. ليست خدمة بثّ ولا تعرض أي محتوى مرئيّ، ولا تستضيف أفلاماً ولا حلقات."
        : "Loopz is a tool for tracking the series, films and anime you watch: mark episodes, rate them, build lists, and see what other people are watching. It is not a streaming service, it plays no video, and it hosts no films or episodes." },
      { title: ar ? "حسابك" : "Your account",
        body: ar
        ? "الدخول عبر Google وحده، وأنت مسؤولٌ عمّا يجري في حسابك. حسابٌ واحدٌ للشخص الواحد، ولا تنتحل شخصية غيرك في اسمك المستعار أو معرّفك أو صورتك."
        : "Sign-in is Google only, and you are responsible for what happens in your account. One account per person, and do not impersonate anyone else in your nickname, username or picture." },
      { title: ar ? "ما تكتبه" : "What you write",
        body: ar
        ? "مراجعاتك وقوائمك وأسماؤها تبقى ملكك. وبنشرها معلنةً تمنحنا إذناً بعرضها داخل Loopz لا غير. ولا يُسمح بما هو غير قانوني أو تحريضيّ أو مضايق، ولا بالمحتوى الجنسي، ولا بالسبام أو الإعلانات، ولا بنشر بيانات أحدٍ الخاصة. ونحتفظ بحقّ إزالة ما يخالف ذلك أو إيقاف الحساب المتكرّر مخالفته."
        : "Your reviews, lists and their names stay yours. Publishing them publicly gives us permission to display them inside Loopz and nowhere else. Not allowed: anything unlawful, harassing or inciting; sexual content; spam or advertising; or posting anyone's private information. We may remove content that breaks these rules and suspend an account that repeatedly does." },
      { title: ar ? "بيانات الأفلام والمسلسلات" : "Film and series data",
        body: ar
        ? "أسماء الأعمال وملصقاتها وأوصافها وتقييماتها العامّة تأتي من TMDB وتخضع لشروطها وحقوق أصحابها. Loopz لا يملكها ولا يدّعي ملكيتها، ودقّتها ليست مضمونةً منّا."
        : "Titles, posters, descriptions and public ratings come from TMDB and remain subject to its terms and to their owners' rights. Loopz neither owns them nor claims to, and we do not guarantee their accuracy." },
      { title: ar ? "الخدمة كما هي" : "The service as it is",
        body: ar
        ? "Loopz يُقدَّم كما هو. نبذل ما نستطيع لإبقائه يعمل وبياناتك سليمة، لكنّا لا نضمن عملاً بلا انقطاع ولا خلوّاً من الأخطاء، ولا نتحمّل مسؤولية ضررٍ غير مباشرٍ ناتجٍ عن الاستخدام. واحتفظ بنسختك من بياناتك المهمّة إن كانت تهمّك."
        : "Loopz is provided as is. We do our best to keep it running and your data intact, but we do not guarantee uninterrupted or error-free service, and we are not liable for indirect damage arising from its use. Keep your own copy of anything that matters to you." },
      { title: ar ? "الإنهاء" : "Ending it",
        body: ar
        ? "تستطيع حذف حسابك متى شئت من الإعدادات. وقد نوقف حساباً يخالف هذه الشروط، أو نوقف الخدمة كلّها بإشعارٍ مسبقٍ معقول."
        : "You can delete your account at any time from Settings. We may suspend an account that breaks these terms, or discontinue the service entirely with reasonable notice." },
    /* 🆕 **بندا الاشتراك والشراكة** (D-795): **صفحةُ بيعٍ بلا شروطٍ
    مكتوبةٍ لا تُفتح لها بوّابةُ دفع** — كلُّ بائعٍ مسجَّلٍ يطلبها،
    **وثمنٌ يُعرض بلا شرطِ تجديدٍ مكتوبٍ وعدٌ ناقص** (D-217).
    🔑 **ولا صفحةَ ثالثةٌ لها**: هذه عائلةُ «الشروط» — **وصفحةٌ
    ثانيةٌ لنفس العائلة تفترق عن أختها عند أوّل تعديل** (القاعدة ٣).
    ⚠️ **والثمنُ من القاموس لا منسوخاً بيد** — وهو الرقمُ نفسُه
    في `/plus` و`/features` وورقة البوّابة وصفِّ الفوترة. */

      { title: ar ? "اشتراك Loopz+" : "The Loopz+ subscription",
        body: ar
        ? `Loopz+ اشتراكٌ اختياريّ للثيمات وتنسيق صفحاتك وشارةٍ بجانب اسمك — والمتابعة والقوائم والمجتمع والبحث تبقى مجّانيةً للجميع دائماً. الثمن ${t.plusPrice}، ${t.plusPriceRenew}، ${t.plusPriceLocal}. والاشتراك يُجدَّد تلقائياً في نهاية مدّته ما لم تُلغِه، والإلغاء متاحٌ في أيّ وقتٍ من إعدادات الاشتراك ويسري في نهاية المدّة المدفوعة — فلا تفقد ما دفعت مقابله. ومن سجّل قبل إعلان الاشتراك يحمل صفة «مؤسِّس» دائماً — والصفة لا تنتهي — ومعها Loopz+ بلا مقابلٍ حتى ${FOUNDER_PLUS_UNTIL.ar}. وتجربة Loopz بلا إعلانات للجميع، مشتركين وغير مشتركين. والاشتراك لم يُفتح بعد؛ ولا يُطلب منك دفعٌ حتى تُفتح بوّابته.`
        : `Loopz+ is an optional subscription for themes, shaping your pages and a badge beside your name — tracking, lists, community and search stay free for everyone, always. It costs ${t.plusPrice}, ${t.plusPriceRenew}, ${t.plusPriceLocal}. It renews automatically at the end of each term unless you cancel; cancelling is available any time from subscription settings and takes effect at the end of the paid term, so you never lose what you already paid for. Anyone who joined before subscriptions were announced keeps Founder status permanently — it never expires — with Loopz+ free until ${FOUNDER_PLUS_UNTIL.en}. Loopz carries no advertising for anyone, subscriber or not. Subscriptions are not open yet, and you are never asked to pay until they are.` },
      { title: ar ? "برنامج شركاء Loopz" : "The Loopz Partners programme",
        body: ar
        ? "الشريك يحصل على ٢٥٪ من صافي كلّ دفعةٍ يدفعها مشترِكٌ انضمّ عبر رابط إحالته، طوال السنة الأولى من اشتراك ذلك العضو. و«الصافي» هو ما يصلنا بعد رسوم الدفع والضرائب. وتُعلَّق العمولة إذا ترك الشريك البرنامج أو أُنهيت شراكته، فهي مقابل شراكةٍ قائمةٍ لا حقٌّ دائم. ويحقّ لنا تعديل النسبة للإحالات الجديدة وحدها بإشعارٍ مسبق، أمّا الإحالات القائمة فتبقى بنسبتها المتّفق عليها. ويُمنع الترويج المضلِّل أو الرسائل غير المرغوبة أو الإحالة الذاتية، ومخالفتها تُنهي الشراكة وتُسقط العمولة غير المدفوعة."
        : "A partner earns 25% of the net on every payment made by a subscriber who joined through their referral link, throughout that member's first year. “Net” means what reaches us after payment fees and taxes. The commission is suspended if the partner leaves the programme or the partnership is ended — it is payment for an ongoing partnership, not a permanent right. We may change the rate for new referrals only, with prior notice; existing referrals keep the rate they were agreed at. Misleading promotion, unsolicited messages and self-referral are prohibited, and a breach ends the partnership and forfeits unpaid commission." },
      { title: ar ? "التغييرات والتواصل" : "Changes and contact",
        body: ar
        ? "قد تتغيّر هذه الشروط؛ التغيير الجوهريّ يُحدَّث تاريخه أعلاه ويُعلَن داخل التطبيق. ولأي سؤال:"
        : "These terms may change; a material change updates the date above and is announced inside the app. For any question:" },

    ],
    contact: LEGAL_CONTACT,
    note: null,
  };
}

export function legalDoc(name: LegalDocName, locale: Locale): LegalDoc {
  return name === "privacy" ? privacyDoc(locale) : termsDoc(locale);
}
