import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { SelectAdditionalValue } from '../types/select-query.types';
import { GraphQLJSON } from './json.scalar';

@ObjectType()
export class SelectOption {
  @Field(() => String)
  value: string | number | boolean;

  @Field(() => String)
  label: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  groupId?: string | number | null;

  @Field(() => GraphQLJSON, { nullable: true })
  additionals?: Record<string, SelectAdditionalValue> | null;
}

@ObjectType()
export class SelectGroup {
  @Field(() => String)
  id: string | number;

  @Field(() => String)
  name: string;
}

@ObjectType()
export class SelectOptions {
  @Field(() => [SelectOption])
  options: SelectOption[];

  @Field(() => [SelectGroup], { nullable: true })
  groups?: SelectGroup[] | null;

  @Field(() => Boolean)
  hasMore: boolean;

  @Field(() => Int, { nullable: true })
  totalCount?: number | null;
}
