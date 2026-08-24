import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";
import { getT } from "@/lib/locale";
import { sanitizeSocials } from "@/lib/socials";
import { sanitizeProfilePrefs } from "@/lib/profilePrefs";
import { EditProfileForm } from "@/components/settings/EditProfileForm";

/**
 * تعديلُ الملفّ — **صفحةٌ حقيقيّةٌ بعد أن كانت تحويلاً** (D-462).
 *
 * **وكان المسارُ يُحوّل إلى `?s=profile`** داخل لوح التبويبات — **فقلمُ
 * الترويسة كان يفتح الإعداداتِ كلَّها ثم يبحث المستخدمُ عن قسمه.**
 * **والآن يفتح ما وعد به**، وروابطُ القلم والصورة القديمة تصل إلى
 * الشاشة نفسِها بلا تغييرٍ فيها.
 */
export default async function EditProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale } = await getT();
  const p = await getProfile();
  /* 🆕 **سجلُّ التخصيص يمرّ كاملاً** (D-561): **اللقبُ يسكنه**، **وحفظُه
     يستبدل العمودَ كلَّه** — **فالنموذجُ يحتاج ما لا يعرضه كي لا
     يمحوَه** (D-462). */
  const prefs = sanitizeProfilePrefs(p?.profile_prefs);

  return (
    <EditProfileForm
      userId={user.id}
      email={user.email ?? ""}
      locale={locale}
      isPrivate={!!p?.is_private}
      genres={p?.favorite_genres ?? []}
      prefs={prefs}
      initial={{
        nickname: p?.nickname ?? "",
        username: p?.username ?? "",
        bio: p?.bio ?? "",
        title: prefs.title,
        avatarUrl: p?.avatar_url ?? null,
        coverUrl: p?.cover_url ?? null,
        coverPos: p?.cover_pos ?? 30,
        avatarPos: p?.avatar_pos ?? 50,
        /* 🆕 **روابطُ التواصل** (D-546) — **منقّاةً عند القراءة أيضاً**:
           صفٌّ كُتب قبل مصفاةٍ صحّت، أو حُرّر بيدٍ، لا يصل الحقلَ خاماً. */
        socials: sanitizeSocials(p?.socials),
      }}
    />
  );
}
