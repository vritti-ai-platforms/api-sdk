import { SetMetadata } from '@nestjs/common';
import { CONSUMER_METADATA } from './constants';
import type { ConsumerOptions } from './jetstream.interfaces';

export const Consume = (options: ConsumerOptions = {}): MethodDecorator => SetMetadata(CONSUMER_METADATA, options);
