import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { GoogleButton } from "@/components/GoogleButton";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  const { locale, t } = await getT();

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <Logo size={72} gradientId="login-logo" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1" dir="ltr">
          {t.brand}
        </h1>
        <p
          className="text-sm font-semibold mb-3 bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, var(--brand-1), var(--brand-2) 55%, var(--brand-3))",
          }}
          dir="ltr"
        >
          {t.taglineEn}
        </p>
        <p className="text-muted text-sm mb-8 leading-relaxed">{t.tagline}</p>
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
