"use client";

// يحلّ محل التخطيط الجذري كاملاً، فلا تصله أنماط التطبيق — الأنماط هنا مضمّنة.
import { useUiLocale } from "@/lib/useUiLocale";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { locale, t } = useUiLocale();

  return (
    <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1220",
          color: "#e8edf7",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <title>{t.errorTitle}</title>
        <main style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📺</div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>{t.errorTitle}</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#93a1bd", margin: 0 }}>
            {t.errorBody}
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#ffb43a",
              color: "#1a1200",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t.errorRetry}
          </button>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#6b7793", marginTop: 20 }} dir="ltr">
              {t.errorCode(error.digest)}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
