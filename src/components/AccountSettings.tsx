"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

/**
 * **ثلاثةُ أقسامٍ لا ثمانية** (D-462): اللغةُ إلى «المظهر»، والاسمُ
 * واسمُ المستخدم إلى `EditProfileForm`، والبريدُ والخروجُ إلى صفحتيهما
 * — **وبقي هنا ما يكتب حقولَ الخصوصيّة وحدَه.**
 */
export type AccountSection = "hideName" | "privateAccount" | "followLists";

export function AccountSettings({
  locale,
  initialNickname,
  avatarUrl,
  genres,
  initialHideName,
  initialIsPrivate = false,
  initialHideFollowLists = false,
  only,
}: {
  /* ⚠️ **يُقبلان ولا يُقرآن — لعمرِ ترقيةٍ واحدة** (D-028) */
  locale: Locale;
  /** يُمرَّر ولا يُعرض — `updateProfile` يكتب `nickname` في كل نداء */
  initialNickname: string;
  avatarUrl: string | null;
  genres: number[];
  initialHideName: boolean;
  /** حسابٌ خاص — المتابعة بطلبٍ يُقبل */
  initialIsPrivate?: boolean;
  initialHideFollowLists?: boolean;
  /** الأقسام المعروضة — الحذف يعني عرض الجميع */
  only?: AccountSection[];
}) {
  const t = getDict(locale);
  const show = (k: AccountSection) => !only || only.includes(k);
  const router = useRouter();
  const [hideName, setHideName] = useState(initialHideName);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [hideFollowLists, setHideFollowLists] = useState(initialHideFollowLists);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        await updateProfile({
          /* ⚠️ **الاسمُ يُعاد كما جاء ولا يُرسَل اسمُ المستخدم**:
             `updateProfile` يكتب `nickname` دائماً، **و`username`
             غيابُه يعني «اتركه»** — **فصفحةُ خصوصيّةٍ لا تملك الحقلَ لا
             يجوز أن تكتبه** (D-462). */
          nickname: initialNickname,
          avatarUrl,
          favoriteGenres: genres,
          hideName,
          isPrivate,
          hideFollowLists,
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


      {/* قفل قائمتَي المتابعة (هجرة 43): العددان يبقيان ظاهرين في الملف —
          هما هويةٌ كزر المتابعة — والمقفول هو ورقتا الأسماء لغير صاحبها */}
      {show("followLists") && (
  <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
          <h2 className="text-sm font-bold mb-1">{t.followListsSection}</h2>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.followListsHint}</p>
          <button
            type="button"
            role="switch"
            aria-checked={hideFollowLists}
            onClick={() => {
              setHideFollowLists((v) => !v);
              setSaved(false);
            }}
            className={`flex items-center gap-3 w-full rounded-xl border px-3 py-2.5 transition ${
              hideFollowLists
                ? "border-accent bg-accent/10"
                : "border-border bg-surface-2 hover:border-accent/50"
            }`}
          >
            <span
              className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition ${
                hideFollowLists ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className="block w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: hideFollowLists ? "translateX(-20px)" : "translateX(0)" }}
              />
            </span>
            <span className="text-sm font-semibold">
              {hideFollowLists ? t.followListsOn : t.followListsOff}
            </span>
          </button>
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

    </div>
  );
}
