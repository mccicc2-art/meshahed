"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { Icon } from "@/components/Icon";

/**
 * 🆕 **صفُّ رفع الهويّة — بيانات الشريك** (D-858، حكمُ أحمد: «إرفاق
 * الـID تبعه»).
 *
 * 🔑 **الملفُّ يصعد من العميل إلى المخزن مباشرةً** (نمطُ `Composer`
 * و`Communities` حرفاً) — **لا عبر جسم أكشن خادمٍ يحدّه المقاس.**
 * **والحَكَمُ المخزنُ نفسُه**: `partner-ids` خاصٌّ بحدّ ٨MB وأنواعٍ
 * أربعة، وسياساتُه تحصر المجلّدَ بصاحبه والقراءةَ به وبالإدارة —
 * **ففحصُ العميل هنا تهذيبٌ للرسالة لا حارس** (D-011).
 *
 * ⚠️ **والاسمُ موقوتٌ** (`id-<ts>.<ext>`): استبدالُ صورةٍ بـPDF لا
 * يترك ملفّين — **القديمُ يُمسح بعد نجاح الجديد لا قبله**، فانقطاعٌ
 * في المنتصف يبقي هويّةً صالحةً لا صفراً.
 */
export function PartnerIdUpload({
  title,
  pickHint,
  doneHint,
  busyHint,
  errTooLarge,
  errType,
  errUpload,
  idFile,
}: {
  title: string;
  pickHint: string;
  doneHint: string;
  busyHint: string;
  errTooLarge: string;
  errType: string;
  errUpload: string;
  idFile: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(f: File) {
    setErr(null);
    const okType = f.type.startsWith("image/") || f.type === "application/pdf";
    if (!okType) {
      setErr(errType);
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setErr(errTooLarge);
      return;
    }
    setBusy(true);
    try {
      const supabase = await createClient();
      const { data: who } = await supabase.auth.getUser();
      const uid = who.user?.id;
      if (!uid) throw new Error("no session");
      const ext =
        f.type === "application/pdf"
          ? "pdf"
          : f.name.split(".").pop()?.toLowerCase().slice(0, 5) || "jpg";
      const path = `${uid}/id-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("partner-ids")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (upErr) throw new Error(upErr.message);
      const { error: rowErr } = await supabase.from("partner_details").upsert({
        user_id: uid,
        id_file: path,
        updated_at: new Date().toISOString(),
      });
      if (rowErr) throw new Error(rowErr.message);
      if (idFile && idFile !== path) {
        await supabase.storage.from("partner-ids").remove([idFile]);
      }
      router.refresh();
    } catch (e) {
      setErr(`${errUpload} — ${(e as Error).message.slice(0, 80)}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const done = !!idFile;
  return (
    <>
      <SettingsRow
        icon="shield"
        title={title}
        subtitle={err ?? (busy ? busyHint : done ? doneHint : pickHint)}
        onClick={() => input.current?.click()}
        trailing={
          done && !busy && !err ? (
            <span className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-accent">
              <Icon name="check" size={11} className="text-accent" strokeWidth={2.2} />
            </span>
          ) : undefined
        }
      />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />
    </>
  );
}
