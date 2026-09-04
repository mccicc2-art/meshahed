import { Redirect } from "expo-router";

/**
 * عنوانُ الرجوع `com.loopztv.app://auth/callback`.
 * التبديلُ الفعليّ (`code` ⇢ جلسة) يقع في `signInWithGoogle` حين يعود
 * المتصفّح؛ هذه الشاشةُ تُوجِّه فقط إن فُتح العنوانُ من خارج ذلك المسار.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
