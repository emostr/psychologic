import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  testId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Выберите хотя бы один класс' })
  @ArrayMaxSize(60)
  @IsString({ each: true })
  classIds!: string[];

  /** Запасные коды сверх численности класса — на случай испорченного листа. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  spare?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class AddClassesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @IsString({ each: true })
  classIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  spare?: number;
}

export class AddCodesDto {
  @IsString()
  classId!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  count!: number;
}
