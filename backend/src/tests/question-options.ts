export interface ChoiceOption {
  text: string;
  score: number;
}

export interface QuestionOptions {
  /** Для SINGLE_CHOICE и MULTIPLE_CHOICE */
  choices?: ChoiceOption[];
  /** Для SCALE */
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  /**
   * Обратный пункт шкалы: балл считается зеркально, (min + max) − значение.
   * Так работают, например, прямые и обратные утверждения у Спилбергера.
   */
  reverse?: boolean;
}

/** То, что видит ученик: баллы вариантов скрыты. */
export interface TakingQuestionOptions {
  choices?: { text: string }[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

export function stripScores(options: QuestionOptions): TakingQuestionOptions {
  return {
    ...(options.choices ? { choices: options.choices.map((c) => ({ text: c.text })) } : {}),
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.step !== undefined ? { step: options.step } : {}),
    ...(options.minLabel ? { minLabel: options.minLabel } : {}),
    ...(options.maxLabel ? { maxLabel: options.maxLabel } : {}),
  };
}

export function scaleOptions(
  min: number,
  max: number,
  minLabel: string,
  maxLabel: string,
  reverse = false,
): QuestionOptions {
  return { min, max, minLabel, maxLabel, step: 1, ...(reverse ? { reverse: true } : {}) };
}

export function choiceOptions(choices: ChoiceOption[]): QuestionOptions {
  return { choices };
}

/** Да/нет с указанным баллом за «да». */
export function yesNo(yesScore = 1, noScore = 0): QuestionOptions {
  return { choices: [{ text: 'Да', score: yesScore }, { text: 'Нет', score: noScore }] };
}
