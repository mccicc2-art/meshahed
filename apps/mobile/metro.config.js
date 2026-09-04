// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

/**
 * ====== Metro يرى `src/core` من جذر المستودع ======
 *
 * 🔑 **النواةُ تُستورد لا تُنسخ**: `apps/mobile` يقرأ `../../src/core` مباشرةً
 * — **الملفُّ نفسُه الذي يخدم الويب**، لا نسخةً تفترق يوماً (القاعدة ٣).
 * والاسمُ المستعار `@/core/*` هو ما تستعمله ملفّاتُ النواة بينها، فيُترجم
 * هنا كما يُترجم في `tsconfig` الويب. **ولا `@/lib` ولا `@/components`**:
 * الحدُّ الذي يحرسه ESLint في الويب يُحرس هنا بغياب الترجمة — استيرادٌ
 * منهما يفشل في Metro فوراً لا في جهاز المختبِر.
 *
 * ⚠️ **مساحةُ عملٍ واحدة (workspaces) تأتي لاحقاً بقرار المالك** — تمسّ
 * `Root Directory` في Vercel. حتى ذلك الحين: حزمتان منفصلتان وجذرٌ مراقَب.
 */
const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const coreDir = path.join(repoRoot, "src", "core");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [coreDir];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];

const baseResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@/core/")) {
    const target = path.join(coreDir, moduleName.slice("@/core/".length));
    return context.resolveRequest(context, target, platform);
  }
  return (baseResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
