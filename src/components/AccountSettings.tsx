"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { LanguageSwitch } from "./LanguageSwitch";

export function AccountSettings({
  email,
  locale,
  initialUsername,
  initialNickname,
  avatarUrl,
  genres,
  initialHideName,
}: {
  email: string;
  locale: Locale;
  initialUsername: string;
  initialNickname: string;
  avatarUrl: string | null;
  genres: number[];
  initialHideName: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [nickname, setNickname] = useState(initialNickname);
  const [hideName, setHideName] = useState(initialHideName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const usernameInvalid = cleaned.length > 0 && cleaned.length < 3;

  function save() {
    setError(null);
    setSaved(false);
    if (usernameInvalid) {
      setError(t.usernameShort);
      return;
    }
    start(async () => {
      try {
        await updateProfile({
          nickname,
          username: cleaned,
          avatarUrl,
          favoriteGenres: genres,
          hideName,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* لغة الواجهة */}
      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">{t.languageSection}</h2>
        <p className="text-sm text-muted mb-4">{t.languageHint}</p>
        <LanguageSwitch locale={locale} />
      </section>

      {/* الخصوصية: إخفاء الاسم في التقييمات والمراجعات */}
      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">{t.hideNameSection}</h2>
        <p className="text-sm text-muted mb-4">{t.hideNameHint}</p>
        <button
          type="button"
          role="switch"
          aria-checked={hideName}
          onClick={() => {
            setHideName((v) => !v);
            setSaved(false);
          }}
          className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 transition ${
            hideName
              ? "border-accent bg-accent/10"
              : "border-border bg-surface-2 hover:border-accent/50"
          }`}
        >
          <span
            className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition ${
              hideName ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                hideName ? "translate-x-0" : ""
              }`}
              style={{ transform: hideName ? "translateX(-20px)" : "translateX(0)" }}
            />
          </span>
          <span className="text-sm font-semibold">
            {hideName ? t.hideNameOn : t.hideNameOff}
          </span>
        </button>
      </section>

      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">{t.usernameSection}</h2>
        <p className="text-sm text-muted mb-4">{t.usernameHint}</p>
        <div className="relative">
          <span className="absolute top-1/2 -translate-y-1/2 start-4 text-muted">@</span>
          <input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setSaved(false);
            }}
            dir="ltr"
            maxLength={24}
            placeholder="ahmed_92"
            className="w-full rounded-xl bg-surface-2 border border-border ps-9 pe-4 py-3 outline-none focus:border-accent transition text-left"
          />
        </div>
        {cleaned !== username.trim().toLowerCase() && username.trim() !== "" && (
          <p className="text-xs text-muted mt-2" dir="ltr">
            {t.willSaveAs(cleaned || "—")}
          </p>
        )}
      </section>

      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">{t.displayNameSection}</h2>
        <p className="text-sm text-muted mb-4">{t.displayNameHint}</p>
        <input
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
          placeholder={t.displayNamePlaceholder}
          className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 outline-none focus:border-accent transition"
        />
      </section>

      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">{t.emailSection}</h2>
        <p className="text-sm text-muted mb-3">{t.emailHint}</p>
        <p className="rounded-xl bg-surface-2 border border-border px-4 py-3 text-muted" dir="ltr">
          {email}
        </p>
      </section>

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="px-6 py-3 rounded-xl bg-accent text-[color:var(--on-accent)] font-semibold hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? t.saving : t.saveSettings}
        </button>
        {saved && <span className="text-sm text-accent-2">{t.savedOk}</span>}
      </div>

      <form action="/auth/signout" method="post" className="pt-4 border-t border-border">
        <button className="text-sm text-muted hover:text-red-300 transition">
          {t.signOutAccount}
        </button>
      </form>
    </div>
  );
}
