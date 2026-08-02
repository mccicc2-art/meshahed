"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/actions";
import { GENRES } from "@/lib/tmdb";
import { Avatar } from "./Avatar";

export function ProfileForm({
  userId,
  email,
  initialNickname,
  initialAvatarUrl,
  initialGenres,
}: {
  userId: string;
  email: string;
  initialNickname: string;
  initialAvatarUrl: string | null;
  initialGenres: number[];
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [genres, setGenres] = useState<number[]>(initialGenres);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleGenre(id: number) {
    setSaved(false);
    setGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  async function onPickFile(file: File) {
    setError(null);
    setSaved(false);

    if (!file.type.startsWith("image/")) {
      setError("الرجاء اختيار ملف صورة.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("حجم الصورة كبير — الحد الأقصى ٢ ميجابايت.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (e) {
      setError("تعذّر رفع الصورة: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateProfile({ nickname, avatarUrl, favoriteGenres: genres });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError("تعذّر الحفظ: " + (e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* الصورة */}
      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-4">الصورة الشخصية</h2>
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar src={avatarUrl} name={nickname || email} size={88} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-surface-2 border border-border text-sm hover:border-accent transition disabled:opacity-60"
            >
              {uploading ? "جارٍ الرفع…" : "تغيير الصورة"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => {
                  setAvatarUrl(null);
                  setSaved(false);
                }}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted hover:text-red-300 hover:border-red-400/60 transition"
              >
                إزالة
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted mt-3">صيغ الصور المدعومة، بحد أقصى ٢ ميجابايت.</p>
      </section>

      {/* الاسم المستعار */}
      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-4">الاسم المستعار</h2>
        <input
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
          placeholder="مثال: أبو محمد"
          className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 outline-none focus:border-accent transition"
        />
        <p className="text-xs text-muted mt-2">{email}</p>
      </section>

      {/* الأنواع المفضلة */}
      <section className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-1">المحتوى المفضّل</h2>
        <p className="text-sm text-muted mb-4">
          اختر أنواعك المفضّلة وبتظهر لك اقتراحات مبنية عليها في الصفحة الرئيسية.
        </p>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const on = genres.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGenre(g.id)}
                className={`px-3.5 py-2 rounded-full text-sm border transition ${
                  on
                    ? "bg-accent text-[#1a1200] border-accent font-semibold"
                    : "bg-surface-2 border-border text-muted hover:text-foreground hover:border-accent/50"
                }`}
              >
                <span className="ml-1">{g.emoji}</span>
                {g.name}
              </button>
            );
          })}
        </div>
        {genres.length > 0 && (
          <p className="text-xs text-muted mt-4">اخترت {genres.length} نوعاً.</p>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending || uploading}
          className="px-6 py-3 rounded-xl bg-accent text-[#1a1200] font-semibold hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
        </button>
        {saved && <span className="text-sm text-accent-2">✓ تم الحفظ</span>}
      </div>
    </div>
  );
}
