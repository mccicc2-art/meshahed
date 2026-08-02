import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { GoogleButton } from "@/components/GoogleButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  const { locale, t } = await getT();

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">📺</div>
        <h1 className="text-3xl font-bold mb-2">{t.brand}</h1>
        <p className="text-muted mb-8">{t.tagline}</p>
        <div className="bg-surface border border-border rounded-2xl p-6">
          {configured ? (
            <GoogleButton locale={locale} />
          ) : (
            <p className="text-sm text-accent leading-relaxed">{t.loginNeedsKeys}</p>
          )}
          <p className="text-xs text-muted mt-4">{t.loginConsent}</p>
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSwitch locale={locale} compact />
        </div>
      </div>
    </div>
  );
}
