import { redirect } from "next/navigation";

// الملف الشخصي صار جزءاً من الصفحة الرئيسية
export default async function ProfilePage() {
  redirect("/");
}
