/**
 * تهيئةُ صورةٍ للرفع — **مصفاةٌ واحدةٌ قبل المخزن** (D-837).
 *
 * **والعلّةُ بلاغُ خالد وأحمد**: «من المتصفّح ما تقدر تغيّر الصورة
 * والهيدر». **والزرُّ يعمل والحقلُ يُفتح والمنتقي يظهر** — **ثم لا
 * يتغيّر شيء.**
 *
 * 📏 **والسببُ مقيسٌ في الصفحة**: صندوقُ الغلاف عند ٩١ بكسلاً من رأس
 * الصفحة، **ورسالةُ «حجم الصورة كبير» تُرسم عند ١٠٥٠** — **تسعمئةٍ
 * وستّين تحتها، خارج الشاشة بشاشةٍ ونصف.** **فالرفضُ يقع صامتاً.**
 *
 * 🔑 **ولماذا المتصفّحُ خاصّةً**: **ما يختاره صاحبُ الحاسوب خلفيّةٌ
 * أو لقطةُ شاشة** — **ثلاثةُ ميجابايتٍ وأربعة عاديّةٌ هناك** —
 * **وصاحبُ الهاتف يختار من ألبومه صورةً مضغوطةً أصلاً.** **فالحدُّ
 * نفسُه يصيب أحدَهما ويعفو عن الآخر.**
 *
 * ⚖️ **والعلاجُ أن يُفعل ما كان يُرفض لأجله لا أن يُرفع الحدّ**: صورةٌ
 * بأربعة آلاف بكسلٍ تُرسم في ألفٍ ومئة على أوسع شاشة — **فالفائضُ
 * يُهدر شبكةَ القارئ ومخزنَ المشروع بلا فرقٍ يُرى.** **فتُصغَّر عند
 * المصدر ثم تُرفع**، **والحدُّ يبقى حارساً أخيراً لا باباً أوّل.**
 */

/** حدُّ المخزن — **الرقمُ نفسُه في كلِّ منتقٍ** (`Composer` و`Communities` وتعديلُ الملفّ) */
export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

/**
 * أطولُ ضلعٍ بعد التصغير.
 *
 * **مشتقٌّ من أوسع ما يُرسم**: الغلافُ ١١٢٠ بكسلاً في العمود الأوسع،
 * **والضِّعفُ لشاشاتِ الكثافة المضاعفة** — **ورقمٌ أكبرُ من ذلك بكسلاتٌ
 * لا تصل العين.**
 */
export const UPLOAD_MAX_EDGE = 1920;

const QUALITIES = [0.85, 0.7, 0.55];

/**
 * تُعيد ملفّاً يسع المخزن — أو الملفَّ نفسَه إن كان يسعه أصلاً.
 *
 * ⚠️ **والمتحرّكةُ تمرّ كما هي**: إعادةُ ترميزِ GIF تقتل حركتَها —
 * **وغلافٌ ساكنٌ ليس الغلافَ الذي اختاره صاحبُه.** **يحرسها الحدُّ
 * وحدَه.**
 *
 * ⚠️ **وكلُّ فشلٍ يُعيد الأصل لا يرمي**: متصفّحٌ بلا `createImageBitmap`
 * أو ملفٌّ لا يُفكّ ترميزُه — **والحدُّ بعدَها يقول كلمتَه.** **ومصفاةٌ
 * تُسقط ما لا تفهمه أسوأُ من غيابها.**
 */
export async function fitForUpload(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  /* **ما وسع المخزنَ وسعت الشاشةُ رسمَه: يُترك كما هو** — **وإعادةُ
     ترميزِ صورةٍ سليمةٍ تُنقص جودتَها بلا مقابل** (وقد تُكبّرها: PNG
     صغيرةٌ تصير JPEG أثقل). */
  if (longest <= UPLOAD_MAX_EDGE && file.size <= UPLOAD_MAX_BYTES) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, UPLOAD_MAX_EDGE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  /* **والجودةُ تنزل درجةً درجةً حتى تسع** — **ولقطةُ شاشةٍ عريضةٌ
     تسع في الأولى، وصورةُ كاميرا بأربعين ميجابكسل قد تحتاج الثالثة.** */
  let best: Blob | null = null;
  for (const q of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", q),
    );
    if (!blob) break;
    best = blob;
    if (blob.size <= UPLOAD_MAX_BYTES) break;
  }
  if (!best) return file;

  /* **والامتدادُ يتبع المحتوى**: مسارُ المخزن يُبنى من اسم الملفّ،
     **و`.png` فوق بايتاتِ JPEG كذبةٌ تُخزَّن.** */
  const stem = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([best], `${stem}.jpg`, { type: "image/jpeg" });
}
