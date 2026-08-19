/**
 * هيكلُ البريد بشكله هو: تبويبان ثم قائمةُ محادثاتٍ (صورةٌ وسطران).
 * كان يرث هيكلَ الجذر (ترويسةُ الرئيسية ورفوفُ ملصقات) — أبعدُ ما يكون
 * عن قائمةِ رسائل.
 */
export default function Loading() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex gap-2">
        <div className="skeleton h-10 w-28 rounded-full" />
        <div className="skeleton h-10 w-28 rounded-full" />
      </div>
      <div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="skeleton w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="skeleton h-4 w-36 max-w-full rounded" />
              <div className="skeleton h-3 w-56 max-w-full rounded mt-2" />
            </div>
            <div className="skeleton h-3 w-10 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
