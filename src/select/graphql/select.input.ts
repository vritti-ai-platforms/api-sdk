import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

@InputType()
export class SelectOptionsInput {
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Field(() => Int, { nullable: true })
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, { nullable: true })
  offset?: number;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  values?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  excludeIds?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  valueKey?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  labelKey?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  descriptionKey?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  additionalKeys?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  groupIdKey?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  orderByKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  @Field(() => String, { nullable: true })
  orderDirection?: 'asc' | 'desc';
}
