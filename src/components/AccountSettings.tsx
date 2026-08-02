"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions";

export function AccountSettings({
  email,
  initialUsername,
  initialNickname,
  avatarUrl,
  genres,
}: {
  email: string;
  initialUsername: string;
  initialNickname: string;
  avatarUrl: string | null;
  genres: number[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [nickname, setNickname] = useState(initialNickname);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const usernameInvalid = cleaned.length > 0 && cleaned.length < 3;

  function save() {
    setError(null);
    setSaved(false);
    if (usernameInvalid) {
      setError("اسم المستخدم يجب أن يكون ٣ أحرف على الأقل.");
      return;
    }
    start(async () => {
      try {
        await updateProfile({
          nickname,
          username: cleaned,
          avatarUrl,
          favoriteGenres: genres,
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
      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">اسم المستخدم</h2>
        <p className="text-sm text-muted mb-4">
          معرّفك الفريد داخل التطبيق. أحرف إنجليزية وأرقام و _ فقط.
        </p>
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
            سيُحفظ كـ: @{cleaned || "—"}
          </p>
        )}
      </section>

      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">الاسم الظاهر</h2>
        <p className="text-sm text-muted mb-4">
          الاسم الذي يظهر تحت صورتك في الملف الشخصي.
        </p>
        <input
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
          placeholder="مثال: أحمد الحربي"
          className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 outline-none focus:border-accent transition"
        />
      </section>

      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">البريد الإلكتروني</h2>
        <p className="text-sm text-muted mb-3">مرتبط بحساب Google ولا يمكن تغييره من هنا.</p>
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
          className="px-6 py-3 rounded-xl bg-accent text-[#1a1200] font-semibold hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
        </button>
        {saved && <span className="text-sm text-accent-2">✓ تم الحفظ</span>}
      </div>

      <form action="/auth/signout" method="post" className="pt-4 border-t border-border">
        <button className="text-sm text-muted hover:text-red-300 transition">
          تسجيل الخروج من الحساب
        </button>
      </form>
    </div>
  );
}
