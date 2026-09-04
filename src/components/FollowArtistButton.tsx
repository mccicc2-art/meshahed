"use client";

import { useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { followArtist, unfollowArtist } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { tap } from "@/lib/haptics";
import { buttonClass } from "./ui/Button";

/**
 * زرّ متابعة فنان — الشقيق البسيط لزرّ متابعة المستخدم.
 *
 * حالتان لا ثلاث: لا حسابَ خاصاً عند TMDB فلا «طلبتَ المتابعة». والمفردات
 * هي مفردات متابعة المستخدم نفسها (followUser / followingUser) — مفهومٌ
 * واحد اسمُه واحد (D-026)، وسياق صفحة الفنان يغني عن كلمة «فنان».
 * الاسم والصورة يُرسَلان مع المتابعة فيُحفظان مع الصفّ (D-048) — صفّ
 * «من فنّانيك» يبقى مقروءاً حين يسقط TMDB.
 */
export function FollowArtistButton({
  personId,
  name,
  profilePath,
  initialFollowing,
  locale,
  className,
}: {
  personId: number;
  name: string | null;
  profilePath: string | null;
  initialFollowing: boolean;
  locale: Locale;
  className?: string;
}) {
  const t = getDict(locale);
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      aria-label={t.followArtistAria}
      onClick={() => {
        tap(10);
        const prev = following;
        setFollowing(!prev);
        start(async () => {
          try {
            if (prev) await unfollowArtist(personId);
            else await followArtist({ personId, name, profilePath });
          } catch (e) {
            setFollowing(prev);
            flashError((e as Error).message);
          }
        });
      }}
      className={buttonClass({
        variant: following ? "surface" : "primary",
        size: "sm",
        className,
      })}
    >
      {following ? t.followingUser : t.followUser}
    </button>
  );
}
