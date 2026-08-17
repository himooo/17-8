from pathlib import Path

path = Path("src/app/curriculum-factory/page.tsx")
text = path.read_text()
start = text.index("          {state.stage === 2 &&")
end = text.index("          {state.stage === 3 &&", start)
block = r'''          {state.stage === 2 && <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void structureWithAi()} disabled={busy}><WandSparkles className="ml-1 h-4 w-4" />إعادة الهيكلة</Button>
              <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={structureWithoutAi}>إعادة بناء من النص</Button>
            </div>
            {ideas.map((idea) => <div key={idea.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <div className="flex items-center gap-2">
                <input value={idea.title} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, title: event.target.value } : entry) } })} className="h-9 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-bold" />
                <span className="rounded bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">{idea.id}</span>
              </div>
              <textarea value={idea.description ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, description: event.target.value } : entry) } })} className="mt-2 min-h-16 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-xs" placeholder="وصف الفكرة" />
              {idea.steps.map((step, index) => <div key={`${idea.id}-${step.step}`} className="mt-2 grid gap-2 rounded-lg border border-white/5 bg-slate-900 p-2 md:grid-cols-[80px_1fr]">
                <div className="text-[10px] text-slate-500">خطوة {index + 1}</div>
                <div className="space-y-2">
                  <input value={step.title ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, steps: entry.steps.map((item) => item.step === step.step ? { ...item, title: event.target.value } : item) } : entry) } })} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-xs" />
                  <textarea value={Array.isArray(step.script) ? step.script.join("\n") : step.script ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, steps: entry.steps.map((item) => item.step === step.step ? { ...item, script: event.target.value } : item) } : entry) } })} className="min-h-20 w-full rounded border border-white/10 bg-slate-950 p-2 text-xs leading-5" placeholder="سكريبت الشرح" />
                  <textarea value={step.notes ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, steps: entry.steps.map((item) => item.step === step.step ? { ...item, notes: event.target.value } : item) } : entry) } })} className="min-h-14 w-full rounded border border-white/10 bg-slate-950 p-2 text-xs leading-5" placeholder="Notes خاصة بالمدرس" />
                </div>
              </div>)}
            </div>)}
            <div className="space-y-3 rounded-xl border border-purple-400/20 bg-purple-400/5 p-3">
              <div className="text-xs font-bold text-purple-100">محرر Slides داخل الخطوات</div>
              <div className="text-[10px] leading-5 text-slate-400">كل خطوة تملك Slide واحدة افتراضياً، ويمكن تقسيمها إلى عدة Slides مع الحفاظ على سكريبت المعلم والنوتس وخطة السبورة وروابط الصور.</div>
              {ideas.flatMap((idea) => idea.steps.map((step) => ({ idea, step }))).map(({ idea, step }) => <div key={`slide-editor-${idea.id}-${step.step}`} className="rounded-lg border border-white/10 bg-slate-950/70 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-cyan-200">{idea.title} · خطوة {step.step}: {step.title}</span>
                  <Button size="sm" variant="outline" className="h-7 border-purple-400/20 bg-transparent px-2 text-[10px] text-purple-100 hover:bg-purple-400/10" onClick={() => addManifestSlide(idea.id, step)}><Plus className="ml-1 h-3.5 w-3.5" />Slide جديدة</Button>
                </div>
                {(step.slides ?? []).map((slide, slideIndex) => <div key={slide.id} className="mb-2 grid gap-2 rounded border border-white/10 bg-slate-900 p-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-[9px] text-slate-500">Slide {slideIndex + 1} · {slide.id}</div>
                    <input value={slide.title ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, title: event.target.value } : item) })} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10px]" placeholder="عنوان الـSlide" />
                    <textarea value={slide.body ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, body: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="محتوى الشرح الظاهر" />
                    <textarea value={Array.isArray(slide.script) ? slide.script.join("\n") : slide.script ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, script: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="سكريبت المعلم" />
                  </div>
                  <div className="space-y-2">
                    <textarea value={slide.notes ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, notes: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="نوتس المعلم — لا تظهر للطلاب" />
                    <textarea value={slide.whiteboardPlan ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, whiteboardPlan: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="خطة السبورة والمعادلات" />
                    <input value={(slide.assetRefs ?? []).join(", ")} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, assetRefs: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : item) })} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10px]" placeholder="معرفات أصول الكتاب مفصولة بفواصل" />
                  </div>
                </div>)}
              </div>)}
            </div>
                    </div>}
'''
path.write_text(text[:start] + block + text[end:])
print("stage2 replaced")
