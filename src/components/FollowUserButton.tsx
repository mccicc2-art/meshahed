"use client";

import { useState, useTransition } from "react";
import { flashError, toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import {
  requestOrFollowUser,
  unfollowUser,
  cancelFollowRequest,
} from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { buttonClass } from "./ui/Button";
import { Icon, type IconName } from "./Icon";

type FollowState = "none" | "following" | "requested";

/**
 * زرّ المتابعة — ثلاث حالاتٍ لا اثنتان (follow_requests.sql).
 *
 * الضغط لا يعرف مسبقاً أيقود لمتابعةٍ أم طلب: الحساب الخاصّ قرارُ صاحبه
 * والقاعدة وحدها تعرفه، فـ`request_or_follow` تُرجع ما وقع ويُظهر الزرّ
 * «طلبتَ المتابعة» أو «تتابعه» بحسب الجواب. الضغط على «طلبتَ» يسحب الطلب،
 * وعلى «تتابعه» يُلغي المتابعة — كلٌّ فعلُه المعاكس بلا قائمة.
 */
export function FollowUserButton({
  targetId,
  locale,
  initialFollowing,
  initialRequested = false,
  variant = "button",
}: {
  targetId: string;
  locale: Locale;
  initialFollowing: boolean;
  initialRequested?: boolean;
  /**
   * 🆕 **شكلان لفعلٍ واحد** (D-281، طلبُ أحمد: «علامة صغيرة في زاوية
   * الصورة +، يضغطها وتتمّ الإضافة») — **`variant` لا مكوّنٌ ثانٍ**
   * (على وزن `QuickAdd` في D-224، و«أيقونةٌ بوجهين» في D-260).
   *
   * ⚠️ **والحالاتُ الثلاثُ هي هي في الشكلين**: الحسابُ الخاصّ يُنتج
   * «طلبتَ المتابعة» **والقاعدةُ وحدها تعرف ذلك** — **فشكلٌ يعرف حالتين
   * من ثلاث يكذب على من ضغطه.**
   */
  variant?: "button" | "corner";
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [state, setState] = useState<FollowState>(
    initialFollowing ? "following" : initialRequested ? "requested" : "none",
  );
  const [pending, start] = useTransition();

  const label =
    state === "following"
      ? t.followingUser
      : state === "requested"
        ? t.followRequested
        : t.followUser;

  const act = () => {
    tap(10);
    const prev = state;
    start(async () => {
      try {
        if (prev === "none") {
          const got = await requestOrFollowUser(targetId);
          if (got === "requested") {
            setState("requested");
            toast(t.followRequestSent, { tone: "info" });
          } else if (got === "following") {
            setState("following");
          }
        } else if (prev === "following") {
          setState("none");
          await unfollowUser(targetId);
        } else {
          setState("none");
          await cancelFollowRequest(targetId);
        }
        router.refresh();
      } catch (e) {
        flashError((e as Error).message);
        setState(prev);
      }
    });
  };

  if (variant === "corner") {
    /* **الشكلُ الزاويّ** — علامةٌ على حافّة الوجه لا زرٌّ تحته.
       ⚠️ **والمساحةُ المرئيّة ٢٦px والملموسةُ ٤٤** (D-033/D-168):
       `before` يمدّ منطقةَ اللمس تسعةَ بكسلاتٍ في كلِّ اتّجاه **بلا أن
       يكبر الشكل** — **وهدفُ لمسٍ بحجم ما تراه العينُ عطلٌ صامتٌ على
       الجوال.**
       **والموضعُ `top-end` والميداليةُ في `bottom-start`** — زاويتان
       متقابلتان **فلا تتزاحمان في «الأكثر مشاركة»** حيث تجتمعان. */
    const icon: IconName =
      state === "following"
        ? "check"
        : state === "requested"
          ? "clock"
          : "plus";
    return (
      <button
        type="button"
        disabled={pending}
        onClick={act}
        aria-label={label}
        title={label}
        className={`absolute -top-1 -end-1 z-10 w-[26px] h-[26px] rounded-full grid place-items-center
          border border-[color:var(--background)] shadow-sm transition
          before:content-[''] before:absolute before:-inset-[9px] before:rounded-full
          disabled:opacity-60 ${
            state === "none"
              ? "bg-accent text-[color:var(--on-accent)]"
              : "bg-surface-2 text-muted"
          }`}
      >
        <Icon name={icon} size={14} />
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={act}
      className={buttonClass({
        variant: state === "none" ? "primary" : "surface",
        className:
          state === "none"
            ? ""
            : "hover:border-[color:var(--error)]/60 hover:text-[color:var(--error)]",
      })}
    >
      {label}
    </button>
  );
}
