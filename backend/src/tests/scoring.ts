import { QuestionType } from '@prisma/client';
import { QuestionOptions } from './question-options';

export interface ScorableQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: QuestionOptions;
}

export interface ResponseItem {
  questionId: string;
  optionIndex?: number;
  optionIndexes?: number[];
  scaleValue?: number;
  textValue?: string;
}

export interface AnswerView {
  questionId: string;
  questionText: string;
  type: QuestionType;
  answerText: string;
  score: number;
}

export interface ScoringResult {
  score: number;
  maxScore: number;
  answers: AnswerView[];
  /** Сколько вопросов ученик пропустил */
  skipped: number;
}

function choiceAt(options: QuestionOptions, index: number) {
  return options.choices?.[index];
}

function scaleScore(options: QuestionOptions, value: number): number {
  const min = options.min ?? 0;
  const max = options.max ?? 10;
  const clamped = Math.min(max, Math.max(min, value));
  return options.reverse ? min + max - clamped : clamped;
}

/** Максимум, который вообще можно набрать — нужен для процентов в графиках. */
export function maxScoreFor(questions: ScorableQuestion[]): number {
  let total = 0;
  for (const question of questions) {
    const options = question.options;
    switch (question.type) {
      case QuestionType.SINGLE_CHOICE:
        total += Math.max(0, ...(options.choices ?? []).map((c) => c.score));
        break;
      case QuestionType.MULTIPLE_CHOICE:
        total += (options.choices ?? []).reduce((sum, c) => sum + Math.max(0, c.score), 0);
        break;
      case QuestionType.SCALE: {
        const min = options.min ?? 0;
        const max = options.max ?? 10;
        total += Math.max(min, max);
        break;
      }
      case QuestionType.TEXT:
        break;
    }
  }
  return total;
}

export function scoreResponses(
  questions: ScorableQuestion[],
  responses: ResponseItem[],
): ScoringResult {
  const byQuestion = new Map(responses.map((r) => [r.questionId, r]));
  let score = 0;
  let skipped = 0;
  const answers: AnswerView[] = [];

  for (const question of questions) {
    const response = byQuestion.get(question.id);
    let answerText = '';
    let questionScore = 0;
    let answered = false;

    if (response) {
      switch (question.type) {
        case QuestionType.SINGLE_CHOICE: {
          const choice = response.optionIndex !== undefined ? choiceAt(question.options, response.optionIndex) : undefined;
          if (choice) {
            questionScore = choice.score;
            answerText = choice.text;
            answered = true;
          }
          break;
        }
        case QuestionType.MULTIPLE_CHOICE: {
          const texts: string[] = [];
          for (const index of response.optionIndexes ?? []) {
            const choice = choiceAt(question.options, index);
            if (choice) {
              questionScore += choice.score;
              texts.push(choice.text);
            }
          }
          if (texts.length) {
            answerText = texts.join(', ');
            answered = true;
          }
          break;
        }
        case QuestionType.SCALE: {
          if (response.scaleValue !== undefined && Number.isFinite(response.scaleValue)) {
            questionScore = scaleScore(question.options, response.scaleValue);
            answerText = String(response.scaleValue);
            answered = true;
          }
          break;
        }
        case QuestionType.TEXT: {
          answerText = (response.textValue ?? '').trim();
          answered = answerText.length > 0;
          break;
        }
      }
    }

    if (!answered) {
      skipped += 1;
    }
    score += questionScore;
    answers.push({
      questionId: question.id,
      questionText: question.text,
      type: question.type,
      answerText,
      score: questionScore,
    });
  }

  return { score, maxScore: maxScoreFor(questions), answers, skipped };
}
