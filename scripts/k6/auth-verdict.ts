/**
 * K6a — `node scripts/k6/auth-verdict.ts < rows.json`
 * المدخل: ناتجُ `query_logs` لـ`AUTH_LOG_SQL` كما هو (`{"result":[…]}`) أو مصفوفةُ الصفوف وحدَها.
 * `--sql` يطبع الاستعلامَ نفسَه كي لا يُنسخ من مكانٍ آخر فيفترقا.
 */
import { AUTH_LOG_SQL, authVerdict, formatVerdict, type AuthRow } from "./authVerdict.ts";

if (process.argv.includes("--sql")) {
  console.log(AUTH_LOG_SQL);
} else {
  let raw = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) raw += chunk;
  const j = JSON.parse(raw) as { result?: AuthRow[] } | AuthRow[];
  const rows = Array.isArray(j) ? j : (j.result ?? []);
  const eps = authVerdict(rows);
  console.log(formatVerdict(eps));
  process.exitCode = eps.some((e) => e.verdict.startsWith("FAIL")) ? 1 : 0;
}
