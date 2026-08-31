<script lang="ts">
  import { goto } from '$app/navigation'
  import {
    Card,
    Input,
    Textarea,
    Select,
    Button,
    Badge,
    Toggle,
    Icon,
    Alert,
    Modal,
    Table,
  } from '$ui'
  import { api, errorMessage } from '$lib/api'
  import { notify } from '$lib/notify'
  import { QUESTION_TYPES, TONES } from '$lib/catalog'
  import type { QuestionType, TestView, Tone } from '$lib/types'

  interface DraftChoice {
    text: string
    score: number | string
  }

  interface DraftQuestion {
    key: number
    text: string
    type: QuestionType
    choices: DraftChoice[]
    min: number | string
    max: number | string
    minLabel: string
    maxLabel: string
    reverse: boolean
  }

  interface DraftLevel {
    key: number
    minScore: number | string
    maxScore: number | string
    label: string
    text: string
    color: string
  }

  interface Props {
    source?: TestView | null
  }

  let { source = null }: Props = $props()

  let seq = 0
  const nextKey = () => (seq += 1)

  let title = $state(source?.title ?? '')
  let description = $state(source?.description ?? '')
  let instructions = $state(source?.instructions ?? '')
  let showResult = $state(source?.showResult ?? false)
  let saving = $state(false)
  let presetOpen = $state(false)
  let presetTarget = $state<number | null>(null)

  function blankQuestion(type: QuestionType = 'SINGLE_CHOICE'): DraftQuestion {
    return {
      key: nextKey(),
      text: '',
      type,
      choices:
        type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
          ? [
              { text: 'Да', score: 1 },
              { text: 'Нет', score: 0 },
            ]
          : [],
      min: 1,
      max: 4,
      minLabel: 'Совсем нет',
      maxLabel: 'Полностью да',
      reverse: false,
    }
  }

  let questions = $state<DraftQuestion[]>(
    source?.questions.length
      ? source.questions.map((q) => ({
          key: nextKey(),
          text: q.text,
          type: q.type,
          choices: (q.options.choices ?? []).map((c) => ({ text: c.text, score: c.score })),
          min: q.options.min ?? 1,
          max: q.options.max ?? 4,
          minLabel: q.options.minLabel ?? '',
          maxLabel: q.options.maxLabel ?? '',
          reverse: Boolean(q.options.reverse),
        }))
      : [blankQuestion()],
  )

  let levels = $state<DraftLevel[]>(
    source?.interpretations.length
      ? source.interpretations.map((i) => ({
          key: nextKey(),
          minScore: i.minScore,
          maxScore: i.maxScore,
          label: i.label,
          text: i.text,
          color: i.color,
        }))
      : [],
  )

  /** Максимум пересчитывается на лету — по нему психолог размечает уровни. */
  const maxScore = $derived(
    questions.reduce((total, q) => {
      if (q.type === 'SINGLE_CHOICE') {
        return total + Math.max(0, ...q.choices.map((c) => Number(c.score) || 0))
      }
      if (q.type === 'MULTIPLE_CHOICE') {
        return total + q.choices.reduce((sum, c) => sum + Math.max(0, Number(c.score) || 0), 0)
      }
      if (q.type === 'SCALE') {
        return total + Math.max(Number(q.min) || 0, Number(q.max) || 0)
      }
      return total
    }, 0),
  )

  const coverage = $derived.by(() => {
    if (!levels.length) {
      return { gaps: [] as string[], overlaps: [] as string[] }
    }
    const sorted = [...levels].sort((a, b) => Number(a.minScore) - Number(b.minScore))
    const gaps: string[] = []
    const overlaps: string[] = []
    for (let i = 1; i < sorted.length; i += 1) {
      const previousMax = Number(sorted[i - 1].maxScore)
      const currentMin = Number(sorted[i].minScore)
      if (currentMin <= previousMax) {
        overlaps.push(`«${sorted[i - 1].label || '—'}» и «${sorted[i].label || '—'}»`)
      } else if (currentMin > previousMax + 1) {
        gaps.push(`${previousMax + 1}–${currentMin - 1}`)
      }
    }
    if (Number(sorted[sorted.length - 1].maxScore) < maxScore) {
      gaps.push(`${Number(sorted[sorted.length - 1].maxScore) + 1}–${maxScore}`)
    }
    if (Number(sorted[0].minScore) > 0) {
      gaps.unshift(`0–${Number(sorted[0].minScore) - 1}`)
    }
    return { gaps, overlaps }
  })

  function addQuestion(type: QuestionType = 'SINGLE_CHOICE') {
    questions = [...questions, blankQuestion(type)]
  }

  function duplicateQuestion(index: number) {
    const copy = { ...questions[index], key: nextKey(), choices: questions[index].choices.map((c) => ({ ...c })) }
    questions = [...questions.slice(0, index + 1), copy, ...questions.slice(index + 1)]
  }

  function removeQuestion(index: number) {
    questions = questions.filter((_, i) => i !== index)
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= questions.length) {
      return
    }
    const copy = [...questions]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    questions = copy
  }

  function changeType(index: number, type: QuestionType) {
    const question = questions[index]
    question.type = type
    if ((type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') && !question.choices.length) {
      question.choices = [
        { text: 'Да', score: 1 },
        { text: 'Нет', score: 0 },
      ]
    }
  }

  function addChoice(index: number) {
    questions[index].choices = [...questions[index].choices, { text: '', score: 0 }]
  }

  function removeChoice(questionIndex: number, choiceIndex: number) {
    questions[questionIndex].choices = questions[questionIndex].choices.filter((_, i) => i !== choiceIndex)
  }

  const CHOICE_PRESETS: { label: string; choices: DraftChoice[] }[] = [
    { label: 'Да / Нет', choices: [{ text: 'Да', score: 1 }, { text: 'Нет', score: 0 }] },
    {
      label: 'Частота (5 вариантов)',
      choices: [
        { text: 'Никогда', score: 0 },
        { text: 'Редко', score: 1 },
        { text: 'Иногда', score: 2 },
        { text: 'Часто', score: 3 },
        { text: 'Всегда', score: 4 },
      ],
    },
    {
      label: 'Согласие (4 варианта)',
      choices: [
        { text: 'Совсем не согласен', score: 0 },
        { text: 'Скорее не согласен', score: 1 },
        { text: 'Скорее согласен', score: 2 },
        { text: 'Полностью согласен', score: 3 },
      ],
    },
    {
      label: 'Да / Иногда / Нет',
      choices: [
        { text: 'Да', score: 2 },
        { text: 'Иногда', score: 1 },
        { text: 'Нет', score: 0 },
      ],
    },
  ]

  function applyPreset(choices: DraftChoice[]) {
    if (presetTarget === null) {
      return
    }
    questions[presetTarget].choices = choices.map((c) => ({ ...c }))
    presetOpen = false
    presetTarget = null
  }

  function applyPresetToAll(choices: DraftChoice[]) {
    questions = questions.map((q) =>
      q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE'
        ? { ...q, choices: choices.map((c) => ({ ...c })) }
        : q,
    )
    presetOpen = false
    presetTarget = null
  }

  function addLevel() {
    const last = levels[levels.length - 1]
    const from = last ? Number(last.maxScore) + 1 : 0
    levels = [
      ...levels,
      {
        key: nextKey(),
        minScore: from,
        maxScore: Math.max(from, maxScore),
        label: '',
        text: '',
        color: 'info',
      },
    ]
  }

  /** Раскладывает шкалу на три равные зоны — обычная отправная точка. */
  function suggestLevels() {
    const third = Math.floor(maxScore / 3)
    levels = [
      { key: nextKey(), minScore: 0, maxScore: third, label: 'Низкий', text: '', color: 'success' },
      { key: nextKey(), minScore: third + 1, maxScore: third * 2, label: 'Средний', text: '', color: 'info' },
      { key: nextKey(), minScore: third * 2 + 1, maxScore: maxScore, label: 'Высокий', text: '', color: 'danger' },
    ]
  }

  function removeLevel(index: number) {
    levels = levels.filter((_, i) => i !== index)
  }

  function buildPayload() {
    return {
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      showResult,
      questions: questions.map((q, index) => ({
        text: q.text.trim(),
        order: index,
        type: q.type,
        options:
          q.type === 'SCALE'
            ? {
                min: Number(q.min),
                max: Number(q.max),
                step: 1,
                minLabel: q.minLabel.trim(),
                maxLabel: q.maxLabel.trim(),
                reverse: q.reverse,
              }
            : q.type === 'TEXT'
              ? {}
              : { choices: q.choices.map((c) => ({ text: c.text.trim(), score: Number(c.score) || 0 })) },
      })),
      interpretations: levels.map((l, index) => ({
        minScore: Number(l.minScore),
        maxScore: Number(l.maxScore),
        label: l.label.trim(),
        text: l.text.trim(),
        color: l.color,
        order: index,
      })),
    }
  }

  function validate(): string | null {
    if (title.trim().length < 3) {
      return 'Дайте тесту название — минимум три символа'
    }
    if (!questions.length) {
      return 'В тесте должен быть хотя бы один вопрос'
    }
    for (const [index, question] of questions.entries()) {
      if (!question.text.trim()) {
        return `Вопрос №${index + 1} без текста`
      }
      if (
        (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') &&
        question.choices.some((c) => !c.text.trim())
      ) {
        return `У вопроса №${index + 1} есть пустой вариант ответа`
      }
      if (question.type === 'SCALE' && Number(question.min) >= Number(question.max)) {
        return `У вопроса №${index + 1} минимум шкалы не меньше максимума`
      }
    }
    if (levels.some((l) => !l.label.trim())) {
      return 'У каждого уровня интерпретации должно быть название'
    }
    if (coverage.overlaps.length) {
      return `Диапазоны уровней пересекаются: ${coverage.overlaps.join(', ')}`
    }
    return null
  }

  async function save(publish: boolean) {
    const problem = validate()
    if (problem) {
      notify.warning(problem)
      return
    }
    saving = true
    try {
      const payload = buildPayload()
      const saved = source
        ? await api.patch<TestView>(`/tests/${source.id}`, payload)
        : await api.post<TestView>('/tests', payload)
      if (publish && !saved.isPublished) {
        await api.post(`/tests/${saved.id}/publish`)
      }
      notify.toast(source ? 'Тест сохранён' : 'Тест создан')
      await goto(`/tests/${saved.id}`)
    } catch (e) {
      notify.error('Не удалось сохранить тест', { text: errorMessage(e) })
    } finally {
      saving = false
    }
  }
</script>

<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
  <div class="xl:col-span-2 space-y-6">
    <Card title="Описание" accent>
      <div class="space-y-4">
        <Input bind:value={title} label="Название теста" placeholder="Например: Адаптация пятиклассников" required />
        <Textarea
          bind:value={description}
          label="Краткое описание"
          rows={2}
          placeholder="Для чего этот тест и что он показывает — увидит только психолог"
        />
        <Textarea
          bind:value={instructions}
          label="Инструкция для ученика"
          rows={3}
          placeholder="Это увидит ученик перед началом. Напишите просто и по делу."
        />
        <Toggle
          bind:checked={showResult}
          label="Показывать ученику его результат"
          hint="Для тревожности и скринингов лучше оставить выключенным: результат интерпретирует психолог."
        />
      </div>
    </Card>

    <Card title="Вопросы" subtitle="{questions.length} шт. · максимум {maxScore} баллов" padding={false}>
      {#snippet actions()}
        <Button
          size="sm"
          variant="ghost"
          icon="list"
          onclick={() => {
            presetTarget = null
            presetOpen = true
          }}
        >
          Шаблоны
        </Button>
      {/snippet}

      <div class="divide-y divide-line">
        {#each questions as question, index (question.key)}
          <div class="p-5">
            <div class="flex items-start gap-3">
              <span
                class="w-7 h-7 shrink-0 bg-surface-3 text-muted flex items-center justify-center text-xs font-bold mt-1"
              >
                {index + 1}
              </span>
              <div class="flex-1 min-w-0 space-y-3">
                <Textarea bind:value={question.text} rows={2} placeholder="Текст вопроса или утверждения" />

                <div class="flex flex-wrap items-center gap-2">
                  <Select
                    value={question.type}
                    options={QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    onchange={(value) => changeType(index, value as QuestionType)}
                    class="w-52"
                  />
                  {#if question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE'}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="list"
                      onclick={() => {
                        presetTarget = index
                        presetOpen = true
                      }}
                    >
                      Шаблон ответов
                    </Button>
                  {/if}
                </div>

                {#if question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE'}
                  <div class="space-y-2">
                    {#each question.choices as choice, choiceIndex (choiceIndex)}
                      <div class="flex items-center gap-2">
                        <Input bind:value={choice.text} placeholder="Вариант ответа" class="flex-1" />
                        <Input bind:value={choice.score} type="number" class="w-24" />
                        <button
                          type="button"
                          aria-label="Удалить вариант"
                          class="p-2 text-faint hover:text-danger transition-colors cursor-pointer shrink-0"
                          onclick={() => removeChoice(index, choiceIndex)}
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                    {/each}
                    <Button size="sm" variant="ghost" icon="plus" onclick={() => addChoice(index)}>
                      Добавить вариант
                    </Button>
                  </div>
                {:else if question.type === 'SCALE'}
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Input bind:value={question.min} label="Минимум" type="number" />
                    <Input bind:value={question.max} label="Максимум" type="number" />
                    <Input bind:value={question.minLabel} label="Подпись слева" />
                    <Input bind:value={question.maxLabel} label="Подпись справа" />
                  </div>
                  <Toggle
                    bind:checked={question.reverse}
                    label="Обратный пункт"
                    hint="Балл считается зеркально: ответ «максимум» даёт минимальный балл. Так размечают прямые и обратные утверждения."
                  />
                {:else}
                  <p class="text-xs text-faint">
                    Свободный ответ баллов не приносит — психолог читает текст в карточке результата.
                  </p>
                {/if}
              </div>

              <div class="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Выше"
                  class="p-1.5 text-faint hover:text-ink transition-colors cursor-pointer disabled:opacity-30"
                  disabled={index === 0}
                  onclick={() => move(index, -1)}
                >
                  <Icon name="chevronUp" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Ниже"
                  class="p-1.5 text-faint hover:text-ink transition-colors cursor-pointer disabled:opacity-30"
                  disabled={index === questions.length - 1}
                  onclick={() => move(index, 1)}
                >
                  <Icon name="chevronDown" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Дублировать"
                  class="p-1.5 text-faint hover:text-accent transition-colors cursor-pointer"
                  onclick={() => duplicateQuestion(index)}
                >
                  <Icon name="copy" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Удалить"
                  class="p-1.5 text-faint hover:text-danger transition-colors cursor-pointer"
                  onclick={() => removeQuestion(index)}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>

      {#snippet footer()}
        <div class="flex flex-wrap gap-2">
          {#each QUESTION_TYPES as type (type.value)}
            <Button size="sm" variant="secondary" icon="plus" onclick={() => addQuestion(type.value)}>
              {type.label}
            </Button>
          {/each}
        </div>
      {/snippet}
    </Card>
  </div>

  <div class="space-y-6">
    <Card title="Итог" accent>
      <dl class="divide-y divide-line text-sm">
        <div class="flex justify-between py-2">
          <dt class="text-muted">Вопросов</dt>
          <dd class="font-bold text-ink tabular-nums">{questions.length}</dd>
        </div>
        <div class="flex justify-between py-2">
          <dt class="text-muted">Максимум баллов</dt>
          <dd class="font-bold text-ink tabular-nums">{maxScore}</dd>
        </div>
        <div class="flex justify-between py-2">
          <dt class="text-muted">Уровней</dt>
          <dd class="font-bold text-ink tabular-nums">{levels.length}</dd>
        </div>
      </dl>
      {#snippet footer()}
        <div class="flex flex-col gap-2">
          <Button block icon="save" loading={saving} onclick={() => save(false)}>Сохранить черновик</Button>
          <Button block variant="secondary" icon="send" loading={saving} onclick={() => save(true)}>
            Сохранить и опубликовать
          </Button>
        </div>
      {/snippet}
    </Card>

    <Card title="Интерпретация" subtitle="Диапазон баллов → уровень" padding={false}>
      {#snippet actions()}
        {#if maxScore > 0}
          <Button size="sm" variant="ghost" icon="sliders" onclick={suggestLevels}>Три зоны</Button>
        {/if}
      {/snippet}

      {#if levels.length}
        <div class="divide-y divide-line">
          {#each levels as level, index (level.key)}
            <div class="p-4 space-y-3">
              <div class="flex items-center gap-2">
                <Input bind:value={level.minScore} type="number" class="w-20" />
                <span class="text-faint text-sm">—</span>
                <Input bind:value={level.maxScore} type="number" class="w-20" />
                <button
                  type="button"
                  aria-label="Удалить уровень"
                  class="ml-auto p-1.5 text-faint hover:text-danger transition-colors cursor-pointer"
                  onclick={() => removeLevel(index)}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
              <Input bind:value={level.label} placeholder="Название уровня" />
              <Select
                bind:value={level.color}
                options={TONES.map((t) => ({ value: t.value, label: t.label }))}
              />
              <Textarea bind:value={level.text} rows={2} placeholder="Что это значит и что делать" />
            </div>
          {/each}
        </div>
      {:else}
        <div class="px-5 py-8 text-center">
          <p class="text-sm text-muted">
            Без уровней результат останется просто числом. Добавьте хотя бы два диапазона.
          </p>
        </div>
      {/if}

      {#snippet footer()}
        <div class="space-y-3">
          {#if coverage.overlaps.length}
            <Alert variant="danger">Диапазоны пересекаются: {coverage.overlaps.join(', ')}</Alert>
          {:else if coverage.gaps.length}
            <Alert variant="warning">
              Не покрыты баллы: {coverage.gaps.join(', ')}. Такие результаты останутся без уровня.
            </Alert>
          {/if}
          <Button size="sm" variant="secondary" icon="plus" block onclick={addLevel}>Добавить уровень</Button>
        </div>
      {/snippet}
    </Card>
  </div>
</div>

<Modal bind:open={presetOpen} title="Шаблоны вариантов ответа" size="lg">
  <p class="text-sm text-muted mb-4">
    {#if presetTarget === null}
      Шаблон применится ко всем вопросам с вариантами ответа.
    {:else}
      Шаблон заменит варианты вопроса №{presetTarget + 1}.
    {/if}
  </p>
  <Table
    columns={[
      { key: 'name', label: 'Шаблон' },
      { key: 'items', label: 'Варианты' },
      { key: 'action', label: '', align: 'right', width: '120px' },
    ]}
    rows={CHOICE_PRESETS}
  >
    {#snippet row(item)}
      <td class="px-4 py-3 align-middle font-semibold text-ink">{item.label}</td>
      <td class="px-4 py-3 align-middle">
        <div class="flex flex-wrap gap-1.5">
          {#each item.choices as choice (choice.text)}
            <Badge variant="neutral">{choice.text} · {choice.score}</Badge>
          {/each}
        </div>
      </td>
      <td class="px-4 py-3 align-middle text-right">
        <Button
          size="sm"
          onclick={() => (presetTarget === null ? applyPresetToAll(item.choices) : applyPreset(item.choices))}
        >
          Применить
        </Button>
      </td>
    {/snippet}
  </Table>
</Modal>
