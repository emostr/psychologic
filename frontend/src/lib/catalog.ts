import type { QuestionType, StudentOrigin, Tone } from './types'

export const CLASS_NUMBERS = Array.from({ length: 11 }, (_, i) => i + 1)

export const CLASS_LETTERS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('')

export const QUESTION_TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'SINGLE_CHOICE', label: 'Один вариант', hint: 'Ученик выбирает ровно один ответ' },
  { value: 'MULTIPLE_CHOICE', label: 'Несколько вариантов', hint: 'Баллы выбранных вариантов складываются' },
  { value: 'SCALE', label: 'Шкала', hint: 'Ползунок от минимума до максимума' },
  { value: 'TEXT', label: 'Свободный ответ', hint: 'Баллы не начисляются, психолог читает текст' },
]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Один вариант',
  MULTIPLE_CHOICE: 'Несколько вариантов',
  SCALE: 'Шкала',
  TEXT: 'Свободный ответ',
}

export const ORIGIN_LABELS: Record<StudentOrigin, string> = {
  TRACKED: 'На карандаше',
  AUTO: 'Автоматически',
}

export const TONES: { value: Tone; label: string }[] = [
  { value: 'success', label: 'Норма' },
  { value: 'info', label: 'Нейтрально' },
  { value: 'accent', label: 'Акцент' },
  { value: 'warning', label: 'Внимание' },
  { value: 'danger', label: 'Тревога' },
  { value: 'neutral', label: 'Без цвета' },
]

/** Готовые метки, которые психолог вешает на карточку ученика. */
export const TAG_PRESETS: { label: string; color: Tone }[] = [
  { label: 'Требует внимания', color: 'warning' },
  { label: 'На контроле', color: 'danger' },
  { label: 'Индивидуальная работа', color: 'accent' },
  { label: 'Беседа с родителями', color: 'info' },
  { label: 'Адаптация', color: 'info' },
  { label: 'Динамика положительная', color: 'success' },
]

export const PIN_INTERVALS: { value: number; label: string }[] = [
  { value: 30, label: '30 минут' },
  { value: 60, label: '1 час' },
  { value: 120, label: '2 часа' },
  { value: 180, label: '3 часа' },
  { value: 360, label: '6 часов' },
  { value: 720, label: '12 часов' },
]
