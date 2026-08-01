import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { GoogleButton } from "@/components/GoogleButton";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">📺</div>
        <h1 className="text-3xl font-bold mb-2">مشاهد</h1>
        <p className="text-muted mb-8">
          تابع مسلسلاتك وأفلامك، أشّر الحلقات، وشوف القادم قريباً.
        </p>
        <div className="bg-surface border border-border rounded-2xl p-6">
          <GoogleButton />
          <p className="text-xs text-muted mt-4">
            بالدخول أنت توافق على استخدام حسابك لحفظ قوائم المشاهدة الخاصة بك فقط.
          </p>
        </div>
      </div>
    </div>
  );
}
