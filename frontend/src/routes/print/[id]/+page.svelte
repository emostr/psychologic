<script lang="ts">
  import { page } from '$app/state'
  import { Button, QrCode, Alert, Skeleton, Icon, Checkbox, Select } from '$ui'
  import { api, errorMessage, qs } from '$lib/api'
  import { auth } from '$lib/auth.svelte'
  import { goto } from '$app/navigation'
  import { formatDate } from '$lib/format'
  import type { PrintSheet } from '$lib/types'

  let sheet = $state<PrintSheet | null>(null)
  let error = $state('')
  let includeUsed = $state(false)
  let density = $state<string | number>(6)
  let showCode = $state(true)

  const columns = $derived(Number(density))
  // Ширина колонки на A4 при полях 8 мм: 194 мм делим на выбранное число.
  const cell = $derived(194 / columns)
  const qrSize = $derived(Math.round(cell * 0.72))

  $effect(() => {
    void auth.ensure().then((profile) => {
      if (!profile) {
        return goto('/login', { replaceState: true })
      }
      return undefined
    })
  })

  $effect(() => {
    const id = page.params.id
    const used = includeUsed
    void api
      .get<PrintSheet>(`/campaigns/${id}/sheet` + qs({ includeUsed: used }))
      .then((value) => {
        sheet = value
        error = ''
      })
      .catch((e) => {
        error = errorMessage(e)
      })
  })

  const totalCodes = $derived(sheet?.classes.reduce((sum, c) => sum + c.codes.length, 0) ?? 0)
</script>

<svelte:head><title>Печать кодов · Психолоджик</title></svelte:head>

<div class="min-h-screen bg-bg">
  <header class="print-hide sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-line">
    <div class="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="sm" icon="arrowLeft" href="/campaigns">К выдачам</Button>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-bold text-ink truncate">{sheet?.title ?? 'Лист кодов'}</div>
        <div class="text-xs text-faint truncate">
          {sheet?.testTitle ?? ''}{totalCodes ? ` · ${totalCodes} кодов` : ''}
        </div>
      </div>
      <Select
        bind:value={density}
        options={[
          { value: 5, label: '5 в ряд — крупнее' },
          { value: 6, label: '6 в ряд — плотно' },
          { value: 7, label: '7 в ряд — очень плотно' },
        ]}
        class="w-48"
      />
      <Checkbox bind:checked={showCode} label="Код текстом" />
      <Checkbox bind:checked={includeUsed} label="С использованными" />
      <Button icon="printer" onclick={() => window.print()} disabled={!sheet}>Печать</Button>
    </div>
  </header>

  <main class="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
    {#if error}
      <Alert variant="danger" title="Не удалось открыть лист">{error}</Alert>
    {:else if !sheet}
      <div class="bg-surface border border-line p-6"><Skeleton rows={5} /></div>
    {:else if !sheet.classes.length}
      <Alert variant="info" title="Печатать нечего">
        Все коды этой выдачи уже использованы. Включите «С использованными», если нужен полный лист,
        или выпустите дополнительные коды в разделе выдач.
      </Alert>
    {:else}
      <div class="print-hide mb-6">
        <Alert variant="info" title="Как это работает">
          Разрежьте лист по сетке и раздайте карточки ученикам. Каждый код открывает тест ровно один раз и
          после прохождения перестаёт работать. Если камера не читает код, ученик может ввести его вручную на
          странице <b>{sheet.baseUrl}/t</b>.
        </Alert>
      </div>

      <div class="print-sheet bg-white text-black mx-auto" style="width: 210mm">
        {#each sheet.classes as cls (cls.classId)}
          <section class="print-class" style="padding: 8mm">
            <header
              class="flex items-end justify-between gap-4 mb-3 pb-2"
              style="border-bottom: 0.4mm solid #000"
            >
              <div>
                <div style="font-size: 16pt; font-weight: 800; line-height: 1.1">Класс {cls.className}</div>
                <div style="font-size: 9pt; margin-top: 1mm">
                  {sheet.testTitle}{cls.homeroomTeacher ? ` · ${cls.homeroomTeacher}` : ''}
                </div>
              </div>
              <div style="font-size: 8pt; text-align: right; line-height: 1.4">
                <div>{cls.codes.length} шт.</div>
                <div>{formatDate(sheet.createdAt)}</div>
                {#if sheet.expiresAt}<div>до {formatDate(sheet.expiresAt)}</div>{/if}
              </div>
            </header>

            <div
              style="display: grid; grid-template-columns: repeat({columns}, 1fr); gap: 0"
            >
              {#each cls.codes as item (item.code)}
                <div
                  class="print-cell"
                  style="border: 0.2mm dashed #999; padding: 2mm 1mm; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1mm; {item.used
                    ? 'opacity: 0.35'
                    : ''}"
                >
                  <QrCode value={item.url} size={qrSize * 3.78} level="M" />
                  {#if showCode}
                    <div style="font-family: ui-monospace, monospace; font-size: 7pt; letter-spacing: 0; font-weight: 700">
                      {item.formatted}
                    </div>
                  {/if}
                  <div style="font-size: 6pt; color: #444">{cls.className} · {item.seq}</div>
                </div>
              {/each}
            </div>

            <footer style="margin-top: 3mm; font-size: 7pt; color: #444">
              Наведите камеру телефона на код — откроется тест. Если код не читается, введите его вручную на
              {sheet.baseUrl}/t
            </footer>
          </section>
        {/each}
      </div>
    {/if}
  </main>
</div>
