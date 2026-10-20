export const JETSTREAM_MODULE_OPTIONS = Symbol('JETSTREAM_MODULE_OPTIONS');
export const JETSTREAM_CONNECTION = Symbol('JETSTREAM_CONNECTION');
export const CONSUMER_METADATA = 'vritti:jetstream-consumer';

export const EVENTS_STREAM = 'EVENTS';
export const TERMINATED_STREAM = 'EVENTS_TERMINATED';
export const TERMINATED_SUBJECT_PREFIX = 'terminated';

export const DEFAULT_MAX_DELIVER = 6;
export const DEFAULT_ACK_WAIT_MS = 30_000;
export const DEFAULT_MAX_ACK_PENDING = 100;
// Handlers run one message at a time, and a message merely queued behind another still has its AckWait
// clock running with nothing to signal progress on its behalf — so anything above 1 redelivers under load
export const DEFAULT_MAX_MESSAGES = 1;
