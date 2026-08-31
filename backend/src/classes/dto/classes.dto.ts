import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CLASS_LETTERS } from '../../common/text';

export class CreateClassDto {
  @IsInt()
  @Min(1)
  @Max(11)
  number!: number;

  @IsIn(CLASS_LETTERS, { message: 'Буква класса — от А до Я' })
  letter!: string;

  @IsInt()
  @Min(0)
  @Max(60)
  plannedSize!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeroomTeacher?: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  plannedSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  homeroomTeacher?: string;
}

export class TransferClassDto {
  @IsInt()
  @Min(1)
  @Max(11)
  number!: number;

  @IsIn(CLASS_LETTERS, { message: 'Буква класса — от А до Я' })
  letter!: string;
}
