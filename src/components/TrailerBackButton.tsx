"use client";

import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { markScrollReturn } from "@/lib/useScrollMemory";

export function TrailerBackButton({
  label,
  fallback,
}: {
  label: string;
  fallback: string;
}) {
  const router = useRouter();

  function goBack() {
    markScrollReturn();
    let sameOriginReferrer = false;
    try {
      sameOriginReferrer =
        Boolean(document.referrer) && new URL(document.referrer).origin === location.origin;
    } catch {
      // A malformed or empty referrer uses the explicit internal fallback.
    }

    if (sameOriginReferrer && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(fallback, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:opacity-70"
    >
      <Icon name="chevron-down" size={20} className="rotate-90 rtl:-rotate-90" />
    </button>
  );
}
