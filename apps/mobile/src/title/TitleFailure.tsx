import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { mark } from "../perfMarks";
import { titleQuery } from "./seed";

/** ارتفاعُ ترويسة `TitleScreen` — الطبقةُ تبدأ تحتها فيبقى الاسمُ والشعارُ ظاهرَين */
const HEADER_H = 64;

/**
 * 🆕 D-1232 — **صفحةُ العمل تقول إنّها فشلت** (تسجيلُ أحمد مساء ١ أكتوبر: ثلاثةُ أفلامٍ متتالية بقيت على الهيكل ٨ ثوانٍ وأكثر
 * حتى رجع بنفسه). `TitleScreen` لم تكن تملك حالةَ خطأ أصلاً: استعلامٌ فشل يُبقي الهيكلَ — أو البذرةَ منذ D-1221 — إلى الأبد
 * بلا زرّ ولا أثر. هذه الطبقةُ تشترك في الاستعلام نفسِه (المفتاحُ واحد، لا طلبَ ثانٍ) وتظهر **فقط** حين لا بيانات وفشل:
 * «حاول مجدداً» يعيد الجلب، و«إغلاق» يرجع. وتكتب `title.open` بـ`result=err` ورمزِ الخطأ (`why`) وحالةِ HTTP (`count`؛
 * ٠ = مهلةٌ أو شبكة) — فالمرّةُ القادمة تقول الأرقامُ أين علق الطلب بدل أن نخمّن.
 * 🔑 **طبقةٌ فوق الشاشة من ملفّ المسار لا تعديلٌ داخلها**: الحالةُ مستقلّةٌ عن شجرة الصفحة (لا تمسّ D-1227)، والملفُّ الكبير لا يُعاد.
 */
export function TitleFailure({ kind, id, onClose }: { kind: "tv" | "movie"; id: number; onClose: () => void }) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const q = useQuery(titleQuery(kind, id));
  const failed = !q.data && q.isError;
  const t0 = useRef(performance.now());
  useEffect(() => {
    if (!failed) return;
    const e = q.error;
    mark("title.open", performance.now() - t0.current, {
      result: "err",
      screen: kind,
      why: e instanceof ApiError ? e.error.code : "network",
      count: e instanceof ApiError ? e.status : 0,
    });
  }, [failed, q.error, kind]);
  if (!failed) return null;
  const key = q.error instanceof ApiError ? q.error.error.message_key : "apiInternal";
  const msg = (t as unknown as Record<string, unknown>)[key];
  return (
    <View
      style={{
        position: "absolute",
        top: insets.top + HEADER_H,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: tokens.bg,
        alignItems: "center",
        paddingTop: 96,
        paddingHorizontal: 16,
        gap: 16,
      }}
    >
      <Text muted style={{ textAlign: "center" }}>{typeof msg === "string" ? msg : t.apiInternal}</Text>
      <Button label={t.errorRetry} onPress={() => void q.refetch()} />
      <Button label={t.closeLabel} variant="ghost" onPress={onClose} />
    </View>
  );
}
