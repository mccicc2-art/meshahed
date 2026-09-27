/**
 * K6b — قراءةُ مصدر المنصّتين نصّاً. **ولمَ لا `import`؟** لأنّ ملفّاتِ التطبيق تستورد React Native، ومساراتُ
 * الخادم تستورد Next وأسماءَ `@/` — ولا يعمل أيٌّ منهما تحت `node --test`. والعقدُ المختبَر هنا **نصّيٌّ أصلاً**:
 * اسمُ مسارٍ في سلسلة، واسمُ علامةٍ في اتّحاد أنواع — ما يكسره حرفٌ لا نوع.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MOBILE = join(ROOT, "apps", "mobile");
export const V1 = join(ROOT, "src", "app", "api", "v1");

export function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** كلُّ ملفّات `.ts`/`.tsx` تحت مجلّد (بلا `node_modules`) */
export function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * التعليقاتُ تُمحى وطولُ النصّ محفوظ (مسافاتٌ بدلها) — كي تبقى المواقعُ صحيحةً للسياق حول كلِّ سلسلة.
 * التعليقاتُ هنا تذكر مساراتٍ مختصرةً (`/api/v1/lists/<id>` · `discover/*`) ليست نداءات.
 */
export function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, pre: string) => pre + blank(m.slice(pre.length)));
}

export const relPath = (abs: string) => relative(ROOT, abs).split(sep).join("/");
