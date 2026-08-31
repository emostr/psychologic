<script lang="ts">
  import { page } from '$app/state'
  import { Icon, Button, Input, Alert, Progress, Skeleton } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { countLabel } from '$lib/format'
  import type { InviteState, SubmitOutcome, TakingQuestion, TakingTest } from '$lib/types'

  type Stage = 'loading' | 'intro' | 'running' | 'review' | 'done' | 'error'

  interface Answer {
    optionIndex?: number
    optionIndexes?: number[]
    scaleValue?: number
    textValue?: string
  }

  let stage = $state<Stage>('loading')
  let errorText = $state('')
  let errorTitle = $state('')

  let className = $state('')
  let intro = $state<{ title: string; description: string; instructions: string; questionCount: number } | null>(
    null,
  )
  let test = $state<TakingTest | null>(null)
  let runToken = $state('')
  let busy = $state(false)

  let lastName = $state('')
  let firstName = $state('')
  let index = $state(0)
  let answers = $state<Record<string, Answer>>({})
  let outcome = $state<SubmitOutcome | null>(null)

  const code = $derived(page.params.code ?? '')
  const question = $derived<TakingQuestion | null>(test?.questions[index] ?? null)
  const answered = $derived(test ? test.questions.filter((q) => isAnswered(q)).length : 0)
  const missing = $derived(test ? test.questions.filter((q) => !isAnswered(q)) : [])

  function isAnswered(q: TakingQuestion): boolean {
    const answer = answers[q.id]
    if (!answer) {
      return false
    }
    if (q.type === 'SINGLE_CHOICE') {
      return answer.optionIndex !== undefined
    }
    if (q.type === 'MULTIPLE_CHOICE') {
      return Boolean(answer.optionIndexes?.length)
    }
    if (q.type === 'SCALE') {
      return answer.scaleValue !== undefined
    }
    return Boolean(answer.textValue?.trim())
  }

  $effect(() => {
    void inspect(code)
  })

  async function inspect(value: string) {
    stage = 'loading'
    try {
      const state = await api.get<InviteState>(`/public/invite/${value}`)
      className = state.className
      if (state.stage === 'resume') {
        test = state.test
        runToken = state.runToken
        firstName = state.studentName
        stage = 'running'
      } else {
        intro = state.test
        stage = 'intro'
      }
    } catch (e) {
      errorTitle = 'Код не подошёл'
      errorText = errorMessage(e)
      stage = 'error'
    }
  }

  async function start(event: Event) {
    event.preventDefault()
    if (lastName.trim().length < 2 || firstName.trim().length < 2) {
      notify.warning('Напишите фамилию и имя полностью')
      return
    }
    busy = true
    try {
      const res = await api.post<{ runToken: string; test: TakingTest; className: string }>(
        `/public/invite/${code}/start`,
        { lastName: lastName.trim(), firstName: firstName.trim() },
      )
      runToken = res.runToken
      test = res.test
      className = res.className
      index = 0
      stage = 'running'
    } catch (e) {
      errorTitle = 'Не удалось начать'
      errorText = errorMessage(e)
      stage = 'error'
    } finally {
      busy = false
    }
  }

  function pickSingle(questionId: string, optionIndex: number) {
    answers[questionId] = { optionIndex }
    // Один вариант — сразу листаем дальше, чтобы не тыкать «Далее» лишний раз.
    setTimeout(next, 180)
  }

  function toggleMultiple(questionId: string, optionIndex: number) {
    const current = new Set(answers[questionId]?.optionIndexes ?? [])
    if (current.has(optionIndex)) {
      current.delete(optionIndex)
    } else {
      current.add(optionIndex)
    }
    answers[questionId] = { optionIndexes: [...current].sort((a, b) => a - b) }
  }

  function setScale(questionId: string, value: number) {
    answers[questionId] = { scaleValue: value }
  }

  function setText(questionId: string, value: string) {
    answers[questionId] = { textValue: value }
  }

  function next() {
    if (!test) {
      return
    }
    if (index < test.questions.length - 1) {
      index += 1
      window.scrollTo({ top: 0 })
    } else {
      stage = 'review'
    }
  }

  function back() {
    if (index > 0) {
      index -= 1
      window.scrollTo({ top: 0 })
    }
  }

  function goToQuestion(questionId: string) {
    const position = test?.questions.findIndex((q) => q.id === questionId) ?? -1
    if (position >= 0) {
      index = position
      stage = 'running'
      window.scrollTo({ top: 0 })
    }
  }

  async function submit() {
    if (!test) {
      return
    }
    busy = true
    try {
      const responses = test.questions
        .filter((q) => isAnswered(q))
        .map((q) => ({ questionId: q.id, ...answers[q.id] }))
      outcome = await api.post<SubmitOutcome>('/public/submit', { runToken, responses })
      stage = 'done'
      window.scrollTo({ top: 0 })
    } catch (e) {
      errorTitle = 'Ответы не отправились'
      errorText = errorMessage(e)
      stage = 'error'
    } finally {
      busy = false
    }
  }

  /** Значения ползунка: для шкалы 0–100 с шагом 5 это 21 деление. */
  function scaleValues(q: TakingQuestion): number[] {
    const min = q.options.min ?? 0
    const max = q.options.max ?? 10
    const step = q.options.step ?? 1
    const values: number[] = []
    for (let value = min; value <= max; value += step) {
      values.push(value)
    }
    return values
  }
</script>

<svelte:head><title>{intro?.title ?? test?.title ?? 'Тест'} · Психолоджик</title></svelte:head>

<div class="min-h-screen bg-bg flex flex-col">
  <header class="h-14 border-b border-line flex items-center justify-between px-4 sm:px-6 shrink-0">
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="w-7 h-7 bg-accent text-on-accent flex items-center justify-center shrink-0">
        <Icon name="brain" size={15} />
      </span>
      <span class="font-extrabold text-ink text-sm truncate">Психолоджик</span>
    </div>
    {#if className}
      <span class="text-xs text-faint shrink-0">Класс {className}</span>
    {/if}
  </header>

  {#if stage === 'running' && test}
    <div class="border-b border-line px-4 sm:px-6 py-2 shrink-0">
      <div class="max-w-2xl mx-auto flex items-center gap-3">
        <span class="text-xs text-muted tabular-nums shrink-0">{index + 1} / {test.questions.length}</span>
        <div class="flex-1">
          <Progress value={index + 1} max={test.questions.length} />
        </div>
      </div>
    </div>
  {/if}

  <main class="flex-1 px-4 sm:px-6 py-8">
    <div class="max-w-2xl mx-auto">
      {#if stage === 'loading'}
        <div class="bg-surface border border-line p-6"><Skeleton rows={4} /></div>
      {:else if stage === 'error'}
        <div class="ng-enter">
          <div class="w-10 h-1 bg-danger mb-4"></div>
          <h1 class="text-2xl font-extrabold text-ink">{errorTitle}</h1>
          <p class="text-muted mt-2 mb-6">{errorText}</p>
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" icon="arrowLeft" href="/t">Ввести другой код</Button>
          </div>
        </div>
      {:else if stage === 'intro' && intro}
        <div class="ng-enter">
          <div class="w-10 h-1 bg-accent mb-4"></div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-ink tracking-normal">{intro.title}</h1>
          {#if intro.description}
            <p class="text-muted mt-2">{intro.description}</p>
          {/if}

          {#if intro.instructions}
            <div class="mt-6">
              <Alert variant="info" title="Как отвечать">
                <span class="whitespace-pre-wrap">{intro.instructions}</span>
              </Alert>
            </div>
          {/if}

          <div class="mt-6 bg-surface border border-line p-5">
            <h2 class="text-base font-bold text-ink mb-1">Как тебя зовут?</h2>
            <p class="text-sm text-muted mb-5">
              Психолог должен понимать, чей это ответ. Пиши как в журнале — фамилию и имя отдельно.
            </p>
            <form class="space-y-4" onsubmit={start}>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input bind:value={lastName} label="Фамилия" placeholder="Иванов" icon="user" autocomplete="family-name" />
                <Input bind:value={firstName} label="Имя" placeholder="Иван" autocomplete="given-name" />
              </div>
              <Button type="submit" block size="lg" loading={busy} iconRight="arrowRight">
                Начать · {countLabel(intro.questionCount, 'вопрос', 'вопроса', 'вопросов')}
              </Button>
            </form>
          </div>

          <p class="text-xs text-faint mt-6">
            Код одноразовый: после прохождения он перестаёт работать. Отвечай честно — здесь нет оценок.
          </p>
        </div>
      {:else if stage === 'running' && question}
        {#key question.id}
          <div class="ng-enter">
            <p class="text-lg sm:text-xl font-bold text-ink leading-snug mb-6">{question.text}</p>

            {#if question.type === 'SINGLE_CHOICE'}
              <div class="space-y-2">
                {#each question.options.choices ?? [] as choice, choiceIndex (choiceIndex)}
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 px-4 py-4 border text-left transition-colors ng-tile-press cursor-pointer {answers[
                      question.id
                    ]?.optionIndex === choiceIndex
                      ? 'border-accent bg-accent/10 text-ink'
                      : 'border-line bg-surface text-ink hover:border-line-strong'}"
                    onclick={() => pickSingle(question.id, choiceIndex)}
                  >
                    <span
                      class="w-5 h-5 border shrink-0 flex items-center justify-center {answers[question.id]
                        ?.optionIndex === choiceIndex
                        ? 'border-accent'
                        : 'border-line-strong'}"
                    >
                      {#if answers[question.id]?.optionIndex === choiceIndex}
                        <span class="w-2.5 h-2.5 bg-accent"></span>
                      {/if}
                    </span>
                    <span class="text-base">{choice.text}</span>
                  </button>
                {/each}
              </div>
            {:else if question.type === 'MULTIPLE_CHOICE'}
              <p class="text-xs text-faint mb-3">Можно выбрать несколько вариантов</p>
              <div class="space-y-2">
                {#each question.options.choices ?? [] as choice, choiceIndex (choiceIndex)}
                  {@const active = answers[question.id]?.optionIndexes?.includes(choiceIndex) ?? false}
                  <button
                    type="button"
                    class="w-full flex items-center gap-3 px-4 py-4 border text-left transition-colors ng-tile-press cursor-pointer {active
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-surface hover:border-line-strong'}"
                    onclick={() => toggleMultiple(question.id, choiceIndex)}
                  >
                    <span
                      class="w-5 h-5 border shrink-0 flex items-center justify-center {active
                        ? 'bg-accent border-accent text-on-accent'
                        : 'border-line-strong'}"
                    >
                      {#if active}<Icon name="check" size={13} stroke={3} />{/if}
                    </span>
                    <span class="text-base text-ink">{choice.text}</span>
                  </button>
                {/each}
              </div>
            {:else if question.type === 'SCALE'}
              {@const values = scaleValues(question)}
              {@const current = answers[question.id]?.scaleValue}
              <div class="bg-surface border border-line p-5">
                <div class="flex items-center justify-between text-xs text-muted mb-3">
                  <span>{question.options.minLabel || question.options.min}</span>
                  <span>{question.options.maxLabel || question.options.max}</span>
                </div>

                {#if values.length <= 12}
                  <div class="grid gap-2" style="grid-template-columns: repeat({Math.min(values.length, 6)}, 1fr)">
                    {#each values as value (value)}
                      <button
                        type="button"
                        class="h-14 border font-bold text-base transition-colors ng-tile-press cursor-pointer {current ===
                        value
                          ? 'bg-accent border-accent text-on-accent'
                          : 'bg-surface-2 border-line text-ink hover:border-accent'}"
                        onclick={() => setScale(question.id, value)}
                      >
                        {value}
                      </button>
                    {/each}
                  </div>
                {:else}
                  <div class="text-center mb-4">
                    <span class="text-4xl font-extrabold text-accent tabular-nums">
                      {current ?? '—'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={question.options.min ?? 0}
                    max={question.options.max ?? 100}
                    step={question.options.step ?? 1}
                    value={current ?? question.options.min ?? 0}
                    class="w-full accent-[var(--ng-accent)] cursor-pointer"
                    oninput={(e) => setScale(question.id, Number((e.target as HTMLInputElement).value))}
                  />
                {/if}
              </div>
            {:else}
              <textarea
                rows="5"
                placeholder="Напиши своими словами…"
                value={answers[question.id]?.textValue ?? ''}
                oninput={(e) => setText(question.id, (e.target as HTMLTextAreaElement).value)}
                class="w-full bg-surface-2 text-ink text-base border border-line focus:border-accent outline-none px-4 py-3 resize-y placeholder:text-faint transition-colors"
              ></textarea>
            {/if}

            <div class="flex items-center gap-2 mt-8">
              <Button variant="secondary" icon="arrowLeft" onclick={back} disabled={index === 0}>Назад</Button>
              <div class="flex-1"></div>
              <Button size="lg" iconRight="arrowRight" onclick={next}>
                {index === (test?.questions.length ?? 1) - 1 ? 'К проверке' : 'Далее'}
              </Button>
            </div>
          </div>
        {/key}
      {:else if stage === 'review' && test}
        <div class="ng-enter">
          <div class="w-10 h-1 bg-accent mb-4"></div>
          <h1 class="text-2xl font-extrabold text-ink tracking-normal">Почти готово</h1>
          <p class="text-muted mt-1 mb-6">
            Отвечено на {answered} из {test.questions.length}
            {countLabel(test.questions.length, 'вопрос', 'вопроса', 'вопросов').split(' ')[1]}.
          </p>

          {#if missing.length}
            <Alert variant="warning" title="Без ответа остались вопросы" class="mb-4">
              Можно вернуться и ответить — или отправить как есть.
            </Alert>
            <div class="border border-line divide-y divide-line mb-6 max-h-64 overflow-y-auto">
              {#each missing as item (item.id)}
                <button
                  type="button"
                  class="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-3"
                  onclick={() => goToQuestion(item.id)}
                >
                  <span class="text-xs text-faint shrink-0 tabular-nums">
                    №{test.questions.indexOf(item) + 1}
                  </span>
                  <span class="text-sm text-ink flex-1 truncate">{item.text}</span>
                  <span class="text-faint shrink-0"><Icon name="chevronRight" size={15} /></span>
                </button>
              {/each}
            </div>
          {:else}
            <Alert variant="success" title="Все вопросы заполнены" class="mb-6">Можно отправлять.</Alert>
          {/if}

          <div class="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon="arrowLeft" onclick={() => (stage = 'running')}>
              Вернуться к вопросам
            </Button>
            <Button size="lg" icon="send" loading={busy} onclick={submit}>Отправить ответы</Button>
          </div>
        </div>
      {:else if stage === 'done'}
        <div class="ng-enter text-center py-10">
          <span class="w-16 h-16 bg-success text-white flex items-center justify-center mx-auto mb-6">
            <Icon name="check" size={32} stroke={3} />
          </span>
          <h1 class="text-2xl font-extrabold text-ink">Спасибо!</h1>
          <p class="text-muted mt-2 max-w-md mx-auto">
            Ответы отправлены психологу. Этот код больше не действует — можно закрыть страницу.
          </p>

          {#if outcome?.showResult}
            <div class="mt-8 bg-surface border border-line border-l-[3px] border-l-accent p-6 text-left max-w-md mx-auto">
              <div class="ng-label text-muted mb-2">Твой результат</div>
              <div class="text-3xl font-extrabold text-ink">
                {outcome.score}<span class="text-muted text-lg font-bold"> из {outcome.maxScore}</span>
              </div>
              {#if outcome.interpretationLabel}
                <div class="text-lg font-bold text-accent mt-2">{outcome.interpretationLabel}</div>
              {/if}
              {#if outcome.interpretationText}
                <p class="text-sm text-muted mt-2">{outcome.interpretationText}</p>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </main>

  <footer class="border-t border-line px-4 sm:px-6 py-4 shrink-0">
    <p class="text-xs text-faint text-center">
      Ответы видит только школьный психолог. Одноклассники и учителя — нет.
    </p>
  </footer>
</div>
