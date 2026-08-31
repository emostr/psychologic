<script lang="ts">
  import { goto } from '$app/navigation'
  import { Icon, Button, Input } from '$ui'

  let code = $state('')
  let error = $state('')

  function normalize(value: string): string {
    return value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  }

  const pretty = $derived.by(() => {
    const clean = normalize(String(code))
    return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4, 8)}` : clean
  })

  async function submit(event: Event) {
    event.preventDefault()
    const clean = normalize(String(code))
    if (clean.length !== 8) {
      error = 'В коде восемь символов — проверьте, всё ли переписали'
      return
    }
    await goto(`/t/${clean}`)
  }
</script>

<svelte:head><title>Вход по коду · Психолоджик</title></svelte:head>

<div class="min-h-screen bg-bg flex flex-col">
  <header class="h-16 border-b border-line flex items-center px-5 shrink-0">
    <div class="flex items-center gap-2.5">
      <span class="w-8 h-8 bg-accent text-on-accent flex items-center justify-center">
        <Icon name="brain" size={17} />
      </span>
      <span class="font-extrabold text-ink">Психо<span class="text-accent">лоджик</span></span>
    </div>
  </header>

  <main class="flex-1 flex items-center justify-center p-5">
    <div class="w-full max-w-sm ng-enter">
      <div class="w-10 h-1 bg-accent mb-4"></div>
      <h1 class="text-2xl font-extrabold text-ink tracking-normal">Введите код</h1>
      <p class="text-muted text-sm mt-1 mb-8">
        Код напечатан под QR-кодом на карточке, которую выдал психолог. Регистр и дефис не важны.
      </p>

      <form class="space-y-4" onsubmit={submit}>
        <Input
          bind:value={code}
          label="Код из карточки"
          placeholder="XXXX-XXXX"
          icon="qr"
          maxlength={9}
          autocomplete="off"
          error={error}
          autofocus
          oninput={() => (error = '')}
        />
        {#if pretty && !error}
          <p class="text-xs text-faint">Понято как: <b class="text-ink">{pretty}</b></p>
        {/if}
        <Button type="submit" block size="lg" iconRight="arrowRight">Открыть тест</Button>
      </form>

      <p class="text-xs text-faint mt-8 pt-6 border-t border-line">
        Проще всего навести на QR-код камеру телефона — сайт откроется сам.
      </p>
    </div>
  </main>
</div>
