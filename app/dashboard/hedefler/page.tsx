// Modül çerçevesi v1 (Faz 2, Görev 4) — Goals modülünün route'u.
// Bu sayfa BİLİNÇLİ olarak minimal bir yer tutucudur: Goals'un veri
// katmanı canlı (migration 0002, lib/db-server saveGoal, /api/goals)
// ama tam UI'ı ayrı bir Faz 2 işidir. Çerçevenin ikinci üyesi olarak
// route'un var olması gerekir (menü öğesi + ModuleGate buradan çalışır);
// UI geldiğinde bu sayfa genişletilir.

import SectionHeader from '@/components/SectionHeader'

export default function HedeflerPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SectionHeader
        title="Hedefler"
        subtitle='"Olmak istediğin kişi" → hedefler → alt hedefler → ölçülebilir ilerleme'
      />
      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm leading-relaxed text-foreground/80">
              Hedef sistemi çalışıyor: Sanchez&apos;le konuşarak hedef oluşturabilirsin,
              hedefler hafıza çekirdeğine (entities) yazılıyor ve semantik aramada görünüyor.
            </p>
            <p className="mt-3 text-2xs text-muted-foreground">
              Hedef listesi ve ilerleme görünümü Faz 2&apos;nin sonraki adımında bu sayfaya gelecek.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
