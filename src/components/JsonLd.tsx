/**
 * حاقنُ البيانات المُهيكلة (JSON-LD) — سطرٌ واحد لا يرسم شيئاً.
 *
 * `dangerouslySetInnerHTML` هنا مقصود ولا خطر فيه: المُدخَل كائنٌ نبنيه
 * نحن في `seo.ts` من ثوابتٍ ونصوصٍ تحريرية، لا من مُدخَل مستخدم. ومع ذلك
 * يُهرَّب `<` احتياطاً — لو تسرّب يوماً نصٌّ فيه `</script>` من مصدرٍ
 * جديد لأنهى الوسمَ مبكراً وحوّل بقيّته إلى HTML قابلٍ للتنفيذ.
 *
 * ولماذا لا نضعه في `metadata`؟ لأن Next لا يعرف JSON-LD: الطريقة
 * الرسمية أن يُكتب وسمَ سكربتٍ داخل الصفحة نفسها.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
