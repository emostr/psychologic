import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePsychologistDto {
  @IsString()
  @MinLength(3, { message: 'Укажите имя психолога' })
  @MaxLength(120)
  fullName!: string;

  /** Если не задан — соберём транслитом из ФИО. */
  @IsOptional()
  @Matches(/^[a-z0-9._-]{3,40}$/, { message: 'Логин: строчные латинские буквы, цифры, точка, дефис' })
  login?: string;
}

export class RenameAccountDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;
}
