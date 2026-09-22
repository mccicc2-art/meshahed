import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * ====== ESLint لتطبيق الجوّال — D-1049 ======
 *
 * 🔑 **بلا تبعيّةٍ جديدة**: `eslint` و`typescript-eslint` و`eslint-plugin-react-hooks` كلُّها في جذر المستودع
 * (تبعيّاتُ `eslint-config-next`)، وNode يحلّها صعوداً من هنا — فلا يثقل `package-lock` التطبيقِ سطرٌ (حدُّ أداة
 * الدفع ~٥٠ ك.ب، `19` §0-quinquies). و`expo lint` يطلب `eslint-config-expo` فتُركت.
 * 🔑 **قاعدتا الخطّافات هما الغاية** (`rules-of-hooks` خطأ · `exhaustive-deps` تحذير): شاشاتٌ أصليّةٌ كثيرةُ
 * الـ`useCallback`، وتبعيّةٌ ناقصةٌ فيها تُرى على الهاتف لا في `tsc`. الباقي قواعدُ TypeScript الموصى بها بلا
 * فحص أنواع (سريعةٌ، وTypeScript نفسُه يفحص الأنواع في `typecheck`).
 */
export default defineConfig([
  globalIgnores(["node_modules/**", ".expo/**", "android/**", "ios/**", "widget/**", "plugins/**", "babel.config.js", "metro.config.js"]),
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      /* `_x` تعني «مقصودٌ إهمالُه» — كما في جذر المستودع */
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      /* `require("../assets/…png")` هو طريقُ الأصول في Metro — ليس خطأً هنا */
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
