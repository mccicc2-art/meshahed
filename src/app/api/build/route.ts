/**
 * بصمة البناء المنشور — سطرٌ واحد يجيب: أيّ نسخةٍ تعمل الآن؟
 *
 * علاج «تسجيل الدخول القديم يظهر ثم يتبدّل»: التبويب المُستأنَف من ذاكرة
 * الجهاز يرسم نسخته القديمة قبل أن يلمس الشبكة، ولا سبيل لصفحةٍ ميتة أن
 * تعرف أنها عتيقة. هذا المسار يعطي الصفحة الحيّة مرجعاً للمقارنة:
 * SwRegister يسأله عند كل عودةٍ للواجهة، فإن اختلفت البصمة أعاد التحميل
 * فوراً بدل انتظار دورة تحديث الـservice worker البطيئة.
 */
import { NextResponse } from "next/server";

// دائماً من الخادم: كاشُ CDN لبصمة نسخةٍ يقلب الدواء داءً
export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse(process.env.VERCEL_GIT_COMMIT_SHA ?? "dev", {
    headers: { "cache-control": "no-store" },
  });
}
