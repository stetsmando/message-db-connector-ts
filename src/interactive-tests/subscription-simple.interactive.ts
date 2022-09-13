// This test will simulate a component running in the wild.
// The situation being tested is if a subscription will detect
// a stimulus command and start a process.

import { randomUUID as uuid } from 'crypto';

import {
  HandlerContext,
  Levels,
  Message,
  MessageStore,
  MessageDbReader,
  MessageDbWriter,
  Subscription,
} from '..';

interface MyCommand {
  type: 'DoAThing'
  data: {
    randomId: string
  },
}

interface MyEvent {
  type: 'AThingHappened'
  data: {
    randomId: string
  }
}

const DEFAULT_CONNECTION_STRING = 'postgresql://message_store@localhost:5432/message_store';
const LOG_LEVEL = Levels.Info;

const entity = `subscriptionTest${Math.random().toString().substring(0, 6)}`;
const commandCategory = `${entity}:command`;
const batchSize = 1;
const intervalTimeMs = 100;
const commandSubscriberId = uuid({ disableEntropyCache: true });
const entitySubscriberId = uuid({ disableEntropyCache: true });
const entityId = uuid({ disableEntropyCache: true });

// Declare our Command handler functions
async function DoAThing(message: Message<MyCommand>, context: HandlerContext): Promise<void> {
  const {
    id, type, data: { randomId },
  } = message;

  context.logger.info(`Handling ${type} command: ${id}`);

  const AThingHappened = new Message<MyEvent>({
    id: uuid({ disableEntropyCache: true }),
    type: 'AThingHappened',
    streamName: `${entity}-${randomId}`,
    data: { randomId },
    metadata: {},
  });

  await context.messageStore.write(AThingHappened);
}
async function MyEventHandler(message: Message<MyEvent>, context: HandlerContext): Promise<any> {
  const {
    id, type, data: { randomId },
  } = message;

  context.logger.info(`Handling ${type} event: ${id}`);
  context.logger.info(`${randomId} should be ${entityId}`);
}

async function AsyncWrapper() {
  const reader = await MessageDbReader.Make({
    pgConnectionConfig: {
      connectionString: DEFAULT_CONNECTION_STRING,
    },
  });
  const writer = await MessageDbWriter.Make({
    pgConnectionConfig: {
      connectionString: DEFAULT_CONNECTION_STRING,
    },
  });
  const messageStore = new MessageStore({ reader, writer, logLevel: LOG_LEVEL });

  const commandStreamSubscription = new Subscription({
    messageStore,
    streamName: commandCategory,
    subscriberId: commandSubscriberId,
    batchSize,
    intervalTimeMs,
    logLevel: LOG_LEVEL,
  });

  commandStreamSubscription.registerHandler<Message<MyCommand>>(DoAThing);

  const entityStreamSubscription = new Subscription({
    messageStore,
    streamName: entity,
    subscriberId: entitySubscriberId,
    batchSize,
    intervalTimeMs,
    logLevel: LOG_LEVEL,
  });

  entityStreamSubscription.registerHandler<Message<MyEvent>>(MyEventHandler, 'AThingHappened');

  commandStreamSubscription.start();
  entityStreamSubscription.start();

  setTimeout(async () => {
    const myCommand = new Message<MyCommand>({
      id: uuid({ disableEntropyCache: true }),
      type: 'DoAThing',
      streamName: `${commandCategory}-${entityId}`,
      data: { randomId: entityId },
      metadata: {},
    });

    await writer.write(myCommand);
  }, 100);

  setTimeout(() => {
    commandStreamSubscription.signalStop();
    entityStreamSubscription.signalStop();
  }, 1000);
}

AsyncWrapper();
