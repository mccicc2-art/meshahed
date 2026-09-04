import React, { useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../src/auth";
import { useApp } from "../src/state";
import { Button, Screen, Text } from "../src/ui";
import { space } from "../src/theme";

/**
 * شاشةُ الدخول — زرٌّ واحد. **Google وحدَها** كما في الويب (قاعدةُ المشروع).
 */
export default function Login() {
  const { session, signInWithGoogle } = useAuth();
  const { t, tokens } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (session) return <Redirect href="/(tabs)/home" />;

  return (
    <Screen style={{ justifyContent: "center", padding: space.xl }}>
      <View style={{ gap: space.lg, alignItems: "center" }}>
        <Text size={40} weight="700" style={{ color: tokens.accent, letterSpacing: 1 }}>Loopz</Text>
        <Text muted style={{ textAlign: "center" }}>{t.loginGateHint}</Text>
        <Button
          label={t.loginContinueGoogle}
          busy={busy}
          style={{ alignSelf: "stretch" }}
          onPress={async () => {
            setBusy(true);
            setErr(null);
            const r = await signInWithGoogle();
            if (!r.ok && r.message !== "cancel" && r.message !== "dismiss") setErr(t.loginFailed + r.message);
            setBusy(false);
          }}
        />
        {err ? <Text style={{ color: tokens.error, textAlign: "center" }}>{err}</Text> : null}
      </View>
    </Screen>
  );
}
