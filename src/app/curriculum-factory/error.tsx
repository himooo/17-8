"use client";

export default function CurriculumFactoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = error?.message ? `حدث خطأ داخل مصنع المناهج: ${error.message.slice(0, 120)}` : "حدث خطأ داخل مصنع المناهج.";
  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-red-400/20 bg-slate-900 p-6 shadow-2xl">
        <h1 className="text-xl font-black text-red-200">تعذر إكمال هذه العملية</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">{message} لم تُحذف المسودة المحفوظة. أعد المحاولة أو أعد تحميل الصفحة، ثم راجع آخر نسخة محفوظة.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={reset} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">إعادة المحاولة</button>
          <button onClick={() => window.location.reload()} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10">إعادة تحميل</button>
        </div>
      </section>
    </main>
  );
}
