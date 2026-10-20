import {
  DiscardPolicy,
  type JetStreamClient,
  type JetStreamManager,
  jetstream,
  jetstreamManager,
  RetentionPolicy,
  StorageType,
  type StreamConfig,
} from '@nats-io/jetstream';
import { connect, type NatsConnection, nanos } from '@nats-io/transport-node';
import { Logger } from '@nestjs/common';
import { EVENTS_STREAM, TERMINATED_STREAM, TERMINATED_SUBJECT_PREFIX } from './constants';
import type { JetStreamModuleOptions } from './jetstream.interfaces';
import { SUBJECT_PREFIX } from './subjects';

export interface JetStreamConnection {
  nats: NatsConnection;
  js: JetStreamClient;
  jsm: JetStreamManager;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GIB = 1024 ** 3;

// Connects and brings both streams to the config this version expects, so no environment is set up by hand
export async function connectJetStream(options: JetStreamModuleOptions): Promise<JetStreamConnection> {
  const logger = new Logger('JetStream');
  const nats = await connect({
    servers: [options.natsUrl],
    name: `${options.service}-jetstream`,
    // A deploy restarts NATS and the apps together, so boot must tolerate a server that is still coming
    // up rather than crash-looping. Bounded, so a genuinely wrong URL still fails the boot inside 2
    // minutes instead of hanging forever.
    waitOnFirstConnect: true,
    maxReconnectAttempts: 60,
    reconnectTimeWait: 2000,
  });
  const jsm = await jetstreamManager(nats);

  // Limits are explicit: an unbounded stream fills the disk and announces itself in production
  await ensureStream(jsm, logger, {
    name: EVENTS_STREAM,
    subjects: [`${SUBJECT_PREFIX}.>`],
    max_age: nanos(30 * DAY_MS),
    max_bytes: GIB,
    // The deduplication window — a publish repeating a Nats-Msg-Id seen inside it is dropped
    duplicate_window: nanos(2 * 60 * 1000),
    ...options.stream,
  });

  // Nothing is dead-lettered by the server: a message that runs out of deliveries simply stops being
  // redelivered, so the registry terminates it and republishes it here where it can be seen.
  await ensureStream(jsm, logger, {
    name: TERMINATED_STREAM,
    subjects: [`${TERMINATED_SUBJECT_PREFIX}.>`],
    max_age: nanos(90 * DAY_MS),
    max_bytes: GIB / 4,
  });

  return { nats, js: jetstream(nats), jsm };
}

// Adds the stream, or updates it when an earlier deploy created it with different limits
async function ensureStream(
  jsm: JetStreamManager,
  logger: Logger,
  config: Partial<StreamConfig> & { name: string; subjects: string[] },
): Promise<void> {
  const desired: Partial<StreamConfig> & { name: string } = {
    storage: StorageType.File,
    retention: RetentionPolicy.Limits,
    discard: DiscardPolicy.Old,
    ...config,
  };
  try {
    await jsm.streams.add(desired);
    logger.log(`Created stream ${config.name} on ${config.subjects.join(', ')}`);
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
    await jsm.streams.update(config.name, desired);
  }
}

// Tells "the stream is already there" apart from a real failure
function isAlreadyExists(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('already in use') || message.includes('stream name already in use');
}
