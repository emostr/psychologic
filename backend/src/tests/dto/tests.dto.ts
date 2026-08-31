import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '@prisma/client';

export class ChoiceDto {
  @IsString()
  @MinLength(1, { message: 'Вариант ответа не может быть пустым' })
  @MaxLength(300)
  text!: string;

  @IsInt()
  score!: number;
}

export class QuestionOptionsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  choices?: ChoiceDto[];

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  step?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  minLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  maxLabel?: string;

  @IsOptional()
  @IsBoolean()
  reverse?: boolean;
}

export class QuestionDto {
  @IsString()
  @MinLength(1, { message: 'Текст вопроса не может быть пустым' })
  @MaxLength(1000)
  text!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuestionOptionsDto)
  options?: QuestionOptionsDto;
}

export class InterpretationDto {
  @IsInt()
  minScore!: number;

  @IsInt()
  maxScore!: number;

  @IsString()
  @MinLength(1, { message: 'У уровня должно быть название' })
  @MaxLength(60)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;

  @IsOptional()
  @IsIn(['accent', 'success', 'warning', 'danger', 'info', 'neutral'])
  color?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateTestDto {
  @IsString()
  @MinLength(3, { message: 'Название теста — минимум 3 символа' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  showResult?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'В тесте должен быть хотя бы один вопрос' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InterpretationDto)
  interpretations?: InterpretationDto[];
}

export class UpdateTestDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Название теста — минимум 3 символа' })
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  showResult?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'В тесте должен быть хотя бы один вопрос' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InterpretationDto)
  interpretations?: InterpretationDto[];
}

export class DuplicateTestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;
}
