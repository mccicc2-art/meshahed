"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { LanguageSwitch } from "./LanguageSwitch";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

export type AccountSection =
  | "language"
  | "hideName"
  | "privateAccount"
  | "username"
  | "displayName"
  | "email"
  | "signout";

export function AccountSettings({
  email,
  locale,
  initialUsername,
  initialNickname,
  avatarUrl,
  genres,
  initialHideName,
  initialIsPrivate = false,
  only,
}: {
  email: string;
  locale: Locale;
  initialUsername: string;
  initialNickname: string;
  avatarUrl: string | null;
  genres: number[];
  initialHideName: boolean;
  /** حسابٌ خاص — المتابعة بطلبٍ يُقبل */
  initialIsPrivate?: boolean;
  /** الأقسام المعروضة — الحذف يعني عرض الجميع */
  only?: AccountSection[];
}) {
  const t = getDict(locale);
  const show = (k: AccountSection) => !only || only.includes(k);
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [nickname, setNickname] = useState(initialNickname);
  const [hideName, setHideName] = useState(initialHideName);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
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
          isPrivate,
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* لغة الواجهة */}
      {show("language") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.languageSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.languageHint}</p>
          <LanguageSwitch locale={locale} />
          {/* نسبة البيانات إلى TMDB — انتقلت من تذييل كل صفحة إلى هنا.
              شروط استخدام TMDB تُلزم بذكرها في مكانٍ ظاهر من المنتج، ولا
              تُلزم بأن تكون تحت كل شاشة. وموضعها هنا مقصود: هذا القسم
              نفسه يشرح أن لغة الواجهة تُغيّر لغة بيانات TMDB. */}
          <p className="text-[11px] text-muted/70 mt-4 pt-3 border-t border-[color:var(--divider)] leading-relaxed">
            {t.tmdbAttribution}
          </p>
        </section>
        )}

      {/* الخصوصية: إخفاء الاسم في التقييمات والمراجعات */}
      {show("hideName") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.hideNameSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.hideNameHint}</p>
          <button
            type="button"
            role="switch"
            aria-checked={hideName}
            onClick={() => {
              setHideName((v) => !v);
              setSaved(false);
            }}
            className={`flex items-center gap-3 w-full rounded-xl border px-3 py-2.5 transition ${
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
        )}

      {/* الحساب الخاص: المتابعة بطلبٍ يُقبل (follow_requests.sql) —
          نفس مفتاح إخفاء الاسم شكلاً، والحفظ بزرّ الحفظ نفسه */}
      {show("privateAccount") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.privateSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.privateHint}</p>
          <button
            type="button"
            role="switch"
            aria-checked={isPrivate}
            onClick={() => {
              setIsPrivate((v) => !v);
              setSaved(false);
            }}
            className={`flex items-center gap-3 w-full rounded-xl border px-3 py-2.5 transition ${
              isPrivate
                ? "border-accent bg-accent/10"
                : "border-border bg-surface-2 hover:border-accent/50"
            }`}
          >
            <span
              className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition ${
                isPrivate ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className="block w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: isPrivate ? "translateX(-20px)" : "translateX(0)" }}
              />
            </span>
            <span className="text-sm font-semibold">
              {isPrivate ? t.privateOn : t.privateOff}
            </span>
          </button>
        </section>
        )}

      {show("username") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.usernameSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.usernameHint}</p>
          <div className="relative" dir="ltr">
            <span className="absolute top-1/2 -translate-y-1/2 start-3 text-muted">@</span>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setSaved(false);
              }}
              maxLength={24}
              placeholder="ahmed_92"
              dir="ltr"
              className="w-full rounded-xl bg-surface-2 border border-border ps-8 pe-3 py-2.5 text-sm outline-none focus:border-accent transition text-left"
            />
          </div>
          {cleaned !== username.trim().toLowerCase() && username.trim() !== "" && (
            <p className="text-xs text-muted mt-2" dir="ltr">
              {t.willSaveAs(cleaned || "—")}
            </p>
          )}
        </section>
        )}

      {show("displayName") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.displayNameSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.displayNameHint}</p>
          <input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setSaved(false);
            }}
            maxLength={40}
            placeholder={t.displayNamePlaceholder}
            className="w-full rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-sm outline-none focus:border-accent transition"
          />
        </section>
        )}

      {show("email") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.emailSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.emailHint}</p>
          <p className="rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-sm text-muted" dir="ltr">
            {email}
          </p>
        </section>
        )}

      {error && (
        <Alert>{error}</Alert>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className={buttonClass()}
        >
          {pending ? t.saving : t.saveSettings}
        </button>
        {saved && (
          <span role="status" className="text-sm text-[color:var(--success)]">
            {t.savedOk}
          </span>
        )}
      </div>

      {show("signout") && (
        <form action="/auth/signout" method="post" className="pt-4 border-t border-border">
          <button className="text-sm text-muted hover:text-red-300 transition">
            {t.signOutAccount}
          </button>
        </form>
      )}
    </div>
  );
}
