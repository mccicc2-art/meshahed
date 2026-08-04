import { redirect } from "next/navigation";

/**
 * الباب القديم لتعديل الملف.
 *
 * صار قسماً داخل صفحة الإعدادات، فبقي المسار محوِّلاً إليه: الروابط
 * القديمة — قلم الترويسة والصورة الشخصية — تصل إلى المكان نفسه.
 */
export default function EditProfileRedirect() {
  redirect("/profile/settings?s=profile");
}
