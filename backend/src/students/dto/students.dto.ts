import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(2, { message: 'Укажите фамилию' })
  @MaxLength(60)
  lastName!: string;

  @IsString()
  @MinLength(2, { message: 'Укажите имя' })
  @MaxLength(60)
  firstName!: string;

  @IsString()
  classId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'Дата рождения в формате ГГГГ-ММ-ДД' })
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class TransferStudentDto {
  @IsString()
  classId!: string;
}

export class SetOriginDto {
  @IsIn(['TRACKED', 'AUTO'])
  origin!: 'TRACKED' | 'AUTO';
}

export class MergeStudentsDto {
  /** Кого поглощаем — все его прохождения и заметки уедут к целевому ученику. */
  @IsString()
  sourceId!: string;
}

export class NoteDto {
  @IsString()
  @MinLength(1, { message: 'Заметка не может быть пустой' })
  @MaxLength(8000)
  text!: string;
}

export class TagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  label!: string;

  @IsOptional()
  @IsIn(['accent', 'success', 'warning', 'danger', 'info', 'neutral'])
  color?: string;
}

export class StudentQueryDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsIn(['TRACKED', 'AUTO'])
  origin?: 'TRACKED' | 'AUTO';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  duplicatesOnly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean;
}
