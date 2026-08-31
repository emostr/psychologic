import { IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(64)
  login!: string;

  @IsString()
  @MaxLength(200)
  password!: string;
}

export class TotpLoginDto {
  @IsString()
  @MaxLength(500)
  ticket!: string;

  @IsString()
  @MaxLength(20)
  code!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(10, { message: 'Пароль должен быть не короче 10 символов' })
  @MaxLength(200)
  newPassword!: string;
}

export class ConfirmTotpDto {
  @IsString()
  @Length(6, 6, { message: 'Код состоит из шести цифр' })
  code!: string;
}

export class SetPinDto {
  @Matches(/^\d{4,8}$/, { message: 'ПИН-код — от 4 до 8 цифр' })
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPin?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  intervalMinutes?: number;
}

export class UnlockDto {
  @IsString()
  @MaxLength(32)
  pin!: string;
}
