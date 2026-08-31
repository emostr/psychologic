import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IdentifyDto {
  @IsString()
  @MinLength(2, { message: 'Напиши фамилию' })
  @MaxLength(60)
  lastName!: string;

  @IsString()
  @MinLength(2, { message: 'Напиши имя' })
  @MaxLength(60)
  firstName!: string;
}

export class ResponseItemDto {
  @IsString()
  questionId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  optionIndex?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  optionIndexes?: number[];

  @IsOptional()
  @IsInt()
  scaleValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  textValue?: string;
}

export class SubmitRunDto {
  @IsString()
  @MaxLength(2000)
  runToken!: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ResponseItemDto)
  responses!: ResponseItemDto[];
}

export class RunQueryDto {
  @IsOptional()
  @IsString()
  testId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
