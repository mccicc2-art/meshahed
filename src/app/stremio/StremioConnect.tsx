"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/core/i18n";
import { stremioLinkAction } from "@/lib/actions";
import { Button, buttonClass } from "@/components/ui/Button";

type Fresh = Awaited<ReturnType<typeof stremioLinkAction>>;

/**
 * 🆕 **أزرارُ الربط في صفحة `/stremio`** (D-1512) — مرآةُ شاشة التطبيق (`StremioScreen`): «جهّز رابطي» يصدر الرابطَ ويعرض
 * التثبيت (التطبيق · Stremio Web · النسخ) **مرّةً واحدة**، ومن رجع وله رابطٌ يرى «رابط جديد» (يوقف القديم) و«ألغِ الربط».
 */
export function StremioConnect({ linked, locale }: { linked: boolean; locale: Locale }) {
  const t = getDict(locale);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [isLinked, setLinked] = useState(linked);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (action: "issue" | "revoke") =>
    start(async () => {
      setErr(false);
      try {
        const r = await stremioLinkAction(action);
        setLinked(r.linked);
        setFresh(action === "issue" && r.linked ? r : null);
        if (r.needsPlus) router.push("/plus");
      } catch {
        setErr(true);
      }
    });

  if (fresh?.manifest_url) {
    const url = fresh.manifest_url;
    return (
      <div className="mt-5">
        <p className="text-15 leading-relaxed">{t.stremioReady}</p>
        <a href={fresh.install_url} className={buttonClass({ size: "lg", full: true, className: "mt-5" })}>
          {t.stremioInstall}
        </a>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <a href={fresh.web_install_url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "surface", full: true })}>
            {t.stremioInstallWeb}
          </a>
          <Button
            variant="surface"
            full
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => {});
            }}
          >
            {copied ? t.stremioCopied : t.stremioCopy}
          </Button>
        </div>
        <p className="mt-4 text-center text-12 text-muted leading-relaxed">{t.stremioLinkOnce}</p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-15 leading-relaxed">{t.stremioIntro}</p>
      <p className="mt-2 text-sm text-muted leading-relaxed">{t.stremioHow1}</p>
      {isLinked ? (
        <div className="mt-5 grid gap-2.5">
          <Button size="lg" full disabled={pending} onClick={() => run("issue")}>
            {t.stremioNewLink}
          </Button>
          <p className="text-center text-12 text-muted">{t.stremioNewLinkSub}</p>
          <Button variant="danger" full disabled={pending} onClick={() => run("revoke")}>
            {t.stremioRevoke}
          </Button>
        </div>
      ) : (
        <Button size="lg" full className="mt-5" disabled={pending} onClick={() => run("issue")}>
          {t.stremioGetLink}
        </Button>
      )}
      {err ? <p className="mt-3 text-center text-sm text-[color:var(--error)]">{t.stremioFailed}</p> : null}
      <p className="mt-4 text-center text-12 text-muted leading-relaxed">{t.stremioCoverage}</p>
    </div>
  );
}
