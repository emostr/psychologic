import { QuestionType } from '@prisma/client';
import { QuestionOptions, choiceOptions, scaleOptions, yesNo } from './question-options';

export interface BuiltInQuestion {
  text: string;
  type: QuestionType;
  options: QuestionOptions;
}

export interface BuiltInInterpretation {
  minScore: number;
  maxScore: number;
  label: string;
  text: string;
  color: string;
}

export interface BuiltInTest {
  /** Стабильный ключ: по нему методика узнаётся при обновлении платформы. */
  key: string;
  title: string;
  description: string;
  instructions: string;
  showResult: boolean;
  questions: BuiltInQuestion[];
  interpretations: BuiltInInterpretation[];
}

// ─── Спилбергер — Ханин ────────────────────────────────────────────────────
// Шкала четырёхбалльная; «прямые» пункты складываются, «обратные» считаются
// зеркально. Ровно это и даёт классическую формулу Σпрямых − Σобратных + 50.

const SPIELBERGER_ANSWERS: [string, string] = ['Нет, это не так', 'Совершенно верно'];

function spielberger(text: string, reverse: boolean): BuiltInQuestion {
  return {
    text,
    type: QuestionType.SCALE,
    options: scaleOptions(1, 4, SPIELBERGER_ANSWERS[0], SPIELBERGER_ANSWERS[1], reverse),
  };
}

const SITUATIONAL_ANXIETY: BuiltInTest = {
  key: 'spielberger-state',
  title: 'Шкала ситуативной тревожности (Спилбергер — Ханин)',
  description:
    'Оценка тревожности «здесь и сейчас»: как ученик чувствует себя в текущий момент. Классическая методика, 20 утверждений.',
  instructions:
    'Прочитай каждое утверждение и отметь, насколько оно описывает твоё состояние ПРЯМО СЕЙЧАС. Не задумывайся подолгу — обычно первый ответ самый точный. Правильных и неправильных ответов здесь нет.',
  showResult: false,
  questions: [
    spielberger('Я спокоен', true),
    spielberger('Мне ничто не угрожает', true),
    spielberger('Я нахожусь в напряжении', false),
    spielberger('Я испытываю сожаление', false),
    spielberger('Я чувствую себя свободно', true),
    spielberger('Я расстроен', false),
    spielberger('Меня волнуют возможные неудачи', false),
    spielberger('Я чувствую себя отдохнувшим', true),
    spielberger('Я встревожен', false),
    spielberger('Я испытываю чувство внутреннего удовлетворения', true),
    spielberger('Я уверен в себе', true),
    spielberger('Я нервничаю', false),
    spielberger('Я не нахожу себе места', false),
    spielberger('Я взвинчен', false),
    spielberger('Я не чувствую скованности и напряжённости', true),
    spielberger('Я доволен', true),
    spielberger('Я озабочен', false),
    spielberger('Я слишком возбуждён, и мне не по себе', false),
    spielberger('Мне радостно', true),
    spielberger('Мне приятно', true),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 30,
      label: 'Низкая',
      text: 'Низкая ситуативная тревожность. Состояние спокойное. Стоит убедиться, что это не защитная реакция и не безразличие к происходящему.',
      color: 'success',
    },
    {
      minScore: 31,
      maxScore: 44,
      label: 'Умеренная',
      text: 'Умеренная ситуативная тревожность — рабочий уровень напряжения, который помогает собраться. Вмешательство не требуется.',
      color: 'info',
    },
    {
      minScore: 45,
      maxScore: 80,
      label: 'Высокая',
      text: 'Высокая ситуативная тревожность. Имеет смысл выяснить, что именно тревожит ученика сейчас, и обучить приёмам саморегуляции.',
      color: 'danger',
    },
  ],
};

const TRAIT_ANXIETY: BuiltInTest = {
  key: 'spielberger-trait',
  title: 'Шкала личностной тревожности (Спилбергер — Ханин)',
  description:
    'Оценка тревожности как устойчивой черты: насколько ученик склонен воспринимать ситуации как угрожающие. 20 утверждений.',
  instructions:
    'Прочитай каждое утверждение и отметь, насколько оно описывает тебя ОБЫЧНО. Отвечай о том, как бывает чаще всего, а не о сегодняшнем настроении.',
  showResult: false,
  questions: [
    spielberger('Я испытываю удовольствие', true),
    spielberger('Я очень быстро устаю', false),
    spielberger('Я легко могу заплакать', false),
    spielberger('Я хотел бы быть таким же счастливым, как и другие', false),
    spielberger('Нередко я проигрываю из-за того, что недостаточно быстро принимаю решения', false),
    spielberger('Обычно я чувствую себя бодрым', true),
    spielberger('Я спокоен, хладнокровен и собран', true),
    spielberger('Ожидаемые трудности обычно очень тревожат меня', false),
    spielberger('Я слишком переживаю из-за пустяков', false),
    spielberger('Я вполне счастлив', true),
    spielberger('Я принимаю всё слишком близко к сердцу', false),
    spielberger('Мне не хватает уверенности в себе', false),
    spielberger('Обычно я чувствую себя в безопасности', true),
    spielberger('Я стараюсь избегать трудностей и критических ситуаций', false),
    spielberger('У меня бывает хандра', false),
    spielberger('Я доволен', true),
    spielberger('Всякие пустяки отвлекают и волнуют меня', false),
    spielberger('Я так сильно переживаю свои разочарования, что потом долго не могу о них забыть', false),
    spielberger('Я уравновешенный человек', true),
    spielberger('Меня охватывает сильное беспокойство, когда я думаю о своих делах и заботах', false),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 30,
      label: 'Низкая',
      text: 'Низкая личностная тревожность. Возможна недооценка реальных трудностей и требований — стоит обратить внимание на ответственность и мотивацию.',
      color: 'success',
    },
    {
      minScore: 31,
      maxScore: 44,
      label: 'Умеренная',
      text: 'Умеренная личностная тревожность — оптимальный уровень. Ученик реагирует на трудности соразмерно.',
      color: 'info',
    },
    {
      minScore: 45,
      maxScore: 80,
      label: 'Высокая',
      text: 'Высокая личностная тревожность. Склонность видеть угрозу в широком круге ситуаций. Рекомендуется индивидуальная работа: снижение значимости оценки, формирование чувства уверенности в успехе.',
      color: 'danger',
    },
  ],
};

// ─── Дембо — Рубинштейн ────────────────────────────────────────────────────
// Классический вариант — отметка на стомиллиметровой линии, поэтому шкала
// 0–100 с шагом 5, а не «сколько-то баллов».

function selfEsteemScale(text: string): BuiltInQuestion {
  return {
    text,
    type: QuestionType.SCALE,
    options: { min: 0, max: 100, step: 5, minLabel: 'Совсем низко', maxLabel: 'Очень высоко' },
  };
}

const SELF_ESTEEM: BuiltInTest = {
  key: 'dembo-rubinstein',
  title: 'Самооценка (Дембо — Рубинштейн)',
  description:
    'Исследование самооценки по семи качествам. Ученик отмечает, насколько развито у него каждое качество.',
  instructions:
    'Перед тобой семь линеек. Каждая обозначает какое-то качество. Внизу линейки — люди, у которых это качество развито хуже всех, вверху — те, у кого лучше всех. Отметь на каждой линейке, где, по-твоему, находишься ты.',
  showResult: false,
  questions: [
    selfEsteemScale('Здоровье'),
    selfEsteemScale('Ум, способности'),
    selfEsteemScale('Характер'),
    selfEsteemScale('Авторитет у сверстников'),
    selfEsteemScale('Умение многое делать своими руками'),
    selfEsteemScale('Внешность'),
    selfEsteemScale('Уверенность в себе'),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 314,
      label: 'Заниженная',
      text: 'Заниженная самооценка (в среднем ниже 45 из 100). Указывает на неблагополучие в развитии личности: ученик недооценивает себя. Требуется поддерживающая работа.',
      color: 'danger',
    },
    {
      minScore: 315,
      maxScore: 419,
      label: 'Средняя',
      text: 'Средняя самооценка (45–59 из 100). Реалистичное представление о себе, но с запасом неуверенности.',
      color: 'warning',
    },
    {
      minScore: 420,
      maxScore: 524,
      label: 'Адекватная',
      text: 'Адекватная самооценка (60–74 из 100). Норма для подросткового возраста: ученик видит и сильные, и слабые стороны.',
      color: 'success',
    },
    {
      minScore: 525,
      maxScore: 700,
      label: 'Завышенная',
      text: 'Завышенная самооценка (75 и выше из 100). Возможны некритичное отношение к себе, закрытость к обратной связи либо защитная реакция.',
      color: 'warning',
    },
  ],
};

// ─── Айзенк, шкала экстраверсии ────────────────────────────────────────────

const EYSENCK_EXTRAVERSION: BuiltInTest = {
  key: 'eysenck-extraversion',
  title: 'Экстраверсия — интроверсия (по Айзенку, сокращённый вариант)',
  description:
    'Экспресс-диагностика направленности личности: 12 вопросов из шкалы экстраверсии EPI. Не заменяет полный опросник, но даёт быстрый ориентир по классу.',
  instructions:
    'Отвечай «Да» или «Нет», не раздумывая долго. Здесь нет хороших и плохих ответов — есть разные люди.',
  showResult: false,
  questions: [
    { text: 'Нравится ли тебе оживление и суета вокруг?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Часто ли тебе нужны друзья, которые могут тебя подбодрить?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Ты обычно из тех, кто не лезет за словом в карман?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Чувствуешь ли ты себя несчастным без общения с людьми?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Предпочитаешь ли ты книги встречам с людьми?', type: QuestionType.SINGLE_CHOICE, options: yesNo(0, 1) },
    { text: 'Легко ли тебе внести оживление в скучную компанию?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Любишь ли ты часто бывать в компании?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Считаешь ли ты себя человеком, полным энергии?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Предпочитаешь ли ты держаться в тени на вечеринках?', type: QuestionType.SINGLE_CHOICE, options: yesNo(0, 1) },
    { text: 'Можешь ли ты дать волю чувствам и повеселиться в шумной компании?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Часто ли ты действуешь быстро, не раздумывая?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
    { text: 'Нравится ли тебе работа, требующая быстрых действий?', type: QuestionType.SINGLE_CHOICE, options: yesNo() },
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 4,
      label: 'Интроверсия',
      text: 'Выраженная интроверсия. Ученик обращён внутрь себя, предпочитает узкий круг общения и спокойную обстановку. Это особенность, а не проблема.',
      color: 'info',
    },
    {
      minScore: 5,
      maxScore: 8,
      label: 'Амбиверсия',
      text: 'Амбиверсия — промежуточный тип. Ученик одинаково хорошо переносит и общение, и уединение.',
      color: 'success',
    },
    {
      minScore: 9,
      maxScore: 12,
      label: 'Экстраверсия',
      text: 'Выраженная экстраверсия. Ученик обращён вовне, ему нужны общение и активность. Стоит учитывать при рассадке и групповой работе.',
      color: 'accent',
    },
  ],
};

// ─── Авторские школьные анкеты ─────────────────────────────────────────────

const FREQUENCY = choiceOptions([
  { text: 'Никогда', score: 0 },
  { text: 'Редко', score: 1 },
  { text: 'Иногда', score: 2 },
  { text: 'Часто', score: 3 },
  { text: 'Всегда', score: 4 },
]);

function frequency(text: string): BuiltInQuestion {
  return { text, type: QuestionType.SINGLE_CHOICE, options: FREQUENCY };
}

const SCHOOL_CLIMATE: BuiltInTest = {
  key: 'school-climate',
  title: 'Анкета школьного климата',
  description:
    'Как ученики воспринимают атмосферу в школе: безопасность, отношения с учителями и одноклассниками. 12 утверждений.',
  instructions:
    'Отметь, насколько часто с тобой происходит то, что описано в утверждении. Анкету видит только школьный психолог.',
  showResult: false,
  questions: [
    frequency('В школе я чувствую себя в безопасности'),
    frequency('Мне интересно на уроках'),
    frequency('Учителя относятся ко мне справедливо'),
    frequency('Если у меня проблема, в школе есть взрослый, к которому я могу обратиться'),
    frequency('В классе меня принимают таким, какой я есть'),
    frequency('У меня есть друзья в классе'),
    frequency('Я иду в школу с хорошим настроением'),
    frequency('Моё мнение в классе учитывают'),
    frequency('Я горжусь тем, что учусь в этой школе'),
    frequency('Мне комфортно на переменах'),
    frequency('Я знаю, к кому обратиться, если увижу несправедливость'),
    frequency('Школьные правила понятны и одинаковы для всех'),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 17,
      label: 'Неблагополучный',
      text: 'Неблагополучное восприятие школьного климата. Ученик не чувствует себя в школе безопасно и принято. Нужна индивидуальная беседа.',
      color: 'danger',
    },
    {
      minScore: 18,
      maxScore: 29,
      label: 'Настораживающий',
      text: 'Настораживающее восприятие: часть школьной жизни вызывает дискомфорт. Стоит уточнить, что именно.',
      color: 'warning',
    },
    {
      minScore: 30,
      maxScore: 40,
      label: 'Нейтральный',
      text: 'Нейтральное восприятие школьного климата: скорее хорошо, чем плохо, но с зонами роста.',
      color: 'info',
    },
    {
      minScore: 41,
      maxScore: 48,
      label: 'Благополучный',
      text: 'Благополучное восприятие школьного климата. Ученик чувствует себя в безопасности и на своём месте.',
      color: 'success',
    },
  ],
};

const BULLYING_SCREENING: BuiltInTest = {
  key: 'bullying-screening',
  title: 'Скрининг школьной травли',
  description:
    'Быстрый скрининг: сталкивается ли ученик с систематической травлей. Высокий балл — повод для немедленной индивидуальной работы.',
  instructions:
    'Отметь, насколько часто это происходило с тобой за последний месяц. Отвечай честно — эти ответы видит только психолог, никто из класса их не увидит.',
  showResult: false,
  questions: [
    frequency('Меня обзывали или высмеивали'),
    frequency('Меня намеренно не брали в общие дела и игры'),
    frequency('Про меня распускали слухи'),
    frequency('Мои вещи прятали, портили или отбирали'),
    frequency('Мне угрожали'),
    frequency('Меня толкали, били или удерживали силой'),
    frequency('Обо мне писали неприятное в чатах или соцсетях'),
    frequency('Я боялся идти в школу из-за кого-то из ребят'),
    frequency('Я чувствовал себя одиноким на переменах'),
    frequency('Когда мне было плохо в школе, никто из взрослых не заметил'),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 4,
      label: 'Признаков нет',
      text: 'Признаков систематической травли не выявлено.',
      color: 'success',
    },
    {
      minScore: 5,
      maxScore: 12,
      label: 'Отдельные эпизоды',
      text: 'Отдельные неприятные эпизоды. Не травля, но стоит понаблюдать за динамикой в классе.',
      color: 'info',
    },
    {
      minScore: 13,
      maxScore: 24,
      label: 'Зона риска',
      text: 'Зона риска: эпизоды повторяются. Нужна беседа с учеником и работа с классом.',
      color: 'warning',
    },
    {
      minScore: 25,
      maxScore: 40,
      label: 'Тревожный сигнал',
      text: 'Тревожный сигнал: признаки систематической травли. Требуется немедленная индивидуальная работа, оповещение классного руководителя и администрации.',
      color: 'danger',
    },
  ],
};

const LEARNING_MOTIVATION: BuiltInTest = {
  key: 'learning-motivation',
  title: 'Учебная мотивация',
  description: 'Отношение к учёбе: интерес, самостоятельность, ориентация на результат. 10 утверждений.',
  instructions: 'Отметь, насколько часто это верно для тебя.',
  showResult: true,
  questions: [
    frequency('Мне интересно узнавать новое на уроках'),
    frequency('Я делаю домашние задания без напоминаний'),
    frequency('Мне важно разобраться в теме, а не просто получить оценку'),
    frequency('Я задаю вопросы, если чего-то не понял'),
    frequency('Я довожу начатое до конца, даже если сложно'),
    frequency('Я читаю или смотрю что-то по школьным темам сам, вне уроков'),
    frequency('Я планирую, что и когда буду делать'),
    frequency('Неудача на контрольной заставляет меня разобраться, а не бросить'),
    frequency('Я понимаю, зачем мне то, чему учат в школе'),
    frequency('Я ставлю себе учебные цели'),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 12,
      label: 'Низкая',
      text: 'Низкая учебная мотивация. Учёба воспринимается как внешняя обязанность. Нужна работа над смыслом и небольшими достижимыми целями.',
      color: 'danger',
    },
    {
      minScore: 13,
      maxScore: 23,
      label: 'Сниженная',
      text: 'Сниженная мотивация: интерес держится на отдельных предметах. Стоит опереться на них.',
      color: 'warning',
    },
    {
      minScore: 24,
      maxScore: 32,
      label: 'Достаточная',
      text: 'Достаточная учебная мотивация. Ученик в целом включён в учёбу.',
      color: 'info',
    },
    {
      minScore: 33,
      maxScore: 40,
      label: 'Высокая',
      text: 'Высокая учебная мотивация с элементами самостоятельного обучения. Важно следить, чтобы она не превращалась в перфекционизм.',
      color: 'success',
    },
  ],
};

const WELLBEING: BuiltInTest = {
  key: 'wellbeing-express',
  title: 'Экспресс-опросник эмоционального благополучия',
  description:
    'Короткий срез самочувствия за последние две недели. Удобно повторять раз в четверть и смотреть динамику.',
  instructions: 'Вспомни последние две недели и отметь, насколько часто ты это чувствовал.',
  showResult: false,
  questions: [
    frequency('Я хорошо высыпался'),
    frequency('У меня было хорошее настроение'),
    frequency('Мне хватало сил на дела дня'),
    frequency('Я мог сосредоточиться, когда нужно'),
    frequency('Мне было с кем поговорить о том, что важно'),
    frequency('Я занимался тем, что мне нравится'),
    frequency('Я спокойно относился к своим ошибкам'),
    frequency('Я чувствовал, что справляюсь'),
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 10,
      label: 'Низкое',
      text: 'Низкое эмоциональное благополучие. Нужна индивидуальная беседа и, при подтверждении, направление к специалисту.',
      color: 'danger',
    },
    {
      minScore: 11,
      maxScore: 18,
      label: 'Сниженное',
      text: 'Сниженное благополучие: ресурсов не хватает. Стоит выяснить причину и понаблюдать в динамике.',
      color: 'warning',
    },
    {
      minScore: 19,
      maxScore: 25,
      label: 'Достаточное',
      text: 'Достаточный уровень эмоционального благополучия.',
      color: 'info',
    },
    {
      minScore: 26,
      maxScore: 32,
      label: 'Высокое',
      text: 'Высокое эмоциональное благополучие: ресурсов хватает, есть поддержка и интересы.',
      color: 'success',
    },
  ],
};

export const BUILT_IN_TESTS: BuiltInTest[] = [
  SITUATIONAL_ANXIETY,
  TRAIT_ANXIETY,
  SELF_ESTEEM,
  EYSENCK_EXTRAVERSION,
  SCHOOL_CLIMATE,
  BULLYING_SCREENING,
  LEARNING_MOTIVATION,
  WELLBEING,
];
