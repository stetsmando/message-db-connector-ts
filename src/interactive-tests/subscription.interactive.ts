/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */

// This test will simulate a component running in the wild.
// The situation being tested is if a subscription will detect
// a stimulus command and start a process.

import { v4 as uuid } from 'uuid';
import {
  HandlerContext,
  InMemoryReader,
  InMemoryStore,
  InMemoryWriter,
  Levels,
  Message,
  MessageStore,
  Subscription,
} from '..';
import { Projection } from '../projection';

export namespace Commands {
  export interface Open {
    type: 'Open'
    data: {
      accountId: string
      firstName: string
      lastName: string
      time: string
    }
  }
  export interface Deposit {
    type: 'Deposit'
    data: { amount: number }
  }
  export interface Debit {
    type: 'Debit'
    data: { amount: number }
  }
}

export namespace Events {
  export interface Opened {
    type: 'Opened'
    data: {
      accountId: string
      firstName: string
      lastName: string
      time: string
    }
  }
  export interface Deposited {
    type: 'Deposited'
    data: { amount: number }
  }
  export interface Debited {
    type: 'Debited'
    data: { amount: number }
  }
  export interface DebitRejected {
    type: 'DebitRejected'
    data: { reason: string }
  }
}

const commandCategory = 'account:command';
const commandSubscriberId = uuid();
const entityCategory = 'account';
const entitySubscriberId = uuid();
const accountId = uuid();

// Declare our Command handler functions
function Open(message: Message<Commands.Open>, context: HandlerContext): Promise<void> {
  const {
    id, type, data: {
      accountId, firstName, lastName, time,
    },
  } = message;

  context.logger.info(`Handling ${type} command: ${id}`);

  // NOTE: This is a great place for idempotency checks to occur!

  const opened = new Message<Events.Opened>({
    id: uuid(),
    type: 'Opened',
    streamName: `${entityCategory}-${accountId}`,
    data: {
      accountId,
      firstName,
      lastName,
      time,
    },
    metadata: { ...message.metadata },
  });

  return context.messageStore.write(opened, 0);
}
async function Debit(message: Message<Commands.Debit>, context: HandlerContext): Promise<any> {
  const {
    id, type, streamName, data: { amount },
  } = message;

  context.logger.info(`Handling ${type} event: ${id}`);

  // First thing we do is run a projection to verify if there are enough funds to approve
  // the debit
  interface Account {
    balance: number
    streamPosition: number
  }

  const projection: Projection<Account, Message<any>> = {
    init: { balance: 0, streamPosition: 0 },
    name: 'AccountBalance',
    handlers: {
      Debited(state: Account, message: Message<Events.Debited>) {
        const { balance } = state;
        const { position, data: { amount } } = message;

        return { balance: balance - amount, streamPosition: position! };
      },
      Deposited(state: Account, message: Message<Events.Deposited>) {
        const { balance } = state;
        const { position, data: { amount } } = message;

        return { balance: balance + amount, streamPosition: position! };
      },
    },
  };

  const { balance, streamPosition } = await context.messageStore.fetch<Account>(
    streamName,
    projection,
  );

  if (amount > balance) {
    // Funds are too low for the debit, reject
    const debitRejected = new Message<Events.DebitRejected>({
      id: uuid(),
      type: 'DebitRejected',
      streamName: `${entityCategory}-${accountId}`,
      data: {
        reason: 'You broke fool.',
      },
      metadata: { ...message.metadata },
    });

    // NOTE: The streamPosition + 1 gives us concurrence safety. This is because if
    // another instance of this component were to write to that stream our position
    // would no longer be correct and the DB will throw and version conflict error
    return context.messageStore.write(debitRejected, streamPosition + 1);
  }

  // We're good and the money is there
  const debited = new Message<Events.Debited>({
    id: uuid(),
    type: 'Debited',
    streamName: `${entityCategory}-${accountId}`,
    data: {
      amount,
    },
    metadata: { ...message.metadata },
  });

  return context.messageStore.write(debited, streamPosition + 1);
}

// Declare our Event handler functions
function Opened(message: Message<Events.Opened>, context: HandlerContext): Promise<void> {
  const {
    position, globalPosition, data: {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      accountId, firstName, lastName, time,
    },
  } = message;

  context.logger.info(`Account Opened
  position:${position}
  globalPosition:${globalPosition}
  Account:${accountId}
  Owner:${firstName} ${lastName}
  Time: ${new Date(time).toLocaleString()}`);

  return Promise.resolve();
}

const batchSize = 1;
const intervalTimeMs = 100;
const inMemoryStore = new InMemoryStore();
const inMemoryReader = new InMemoryReader(inMemoryStore);
const inMemoryWriter = new InMemoryWriter(inMemoryStore);

const messageStore = new MessageStore({
  reader: inMemoryReader,
  writer: inMemoryWriter,
});

const commandStreamSubscription = new Subscription({
  messageStore,
  streamName: commandCategory,
  subscriberId: commandSubscriberId,
  batchSize,
  intervalTimeMs,
  logLevel: Levels.Debug,
});

commandStreamSubscription.registerHandler<Message<Commands.Open>>(Open);
commandStreamSubscription.registerHandler<Message<Commands.Debit>>(Debit);

const entityStreamSubscription = new Subscription({
  messageStore,
  streamName: entityCategory,
  subscriberId: entitySubscriberId,
  batchSize,
  intervalTimeMs,
  logLevel: Levels.Debug,
});

entityStreamSubscription.registerHandler<Message<Events.Opened>>(Opened);

commandStreamSubscription.start();
entityStreamSubscription.start();

setTimeout(() => {
  const openCommand = new Message<Commands.Open>({
    id: uuid(),
    type: 'Open',
    streamName: `${commandCategory}-${accountId}`,
    data: {
      accountId,
      firstName: 'John',
      lastName: 'Doe',
      time: new Date().toISOString(),
    },
    metadata: {
      traceId: uuid(),
    },
    position: 0,
    globalPosition: 1,
    time: new Date().toISOString(),
  });

  inMemoryWriter.write(openCommand);
  setTimeout(() => {
    const debit = new Message<Commands.Debit>({
      id: uuid(),
      streamName: `${commandCategory}-${accountId}`,
      type: 'Debit',
      data: {
        amount: 100,
      },
      metadata: {
        traceId: uuid(),
      },
    });

    inMemoryWriter.write(debit);
  }, 200);
}, 100);

setTimeout(() => {
  commandStreamSubscription.signalStop();
  entityStreamSubscription.signalStop();

  console.log(JSON.stringify({ store: inMemoryStore.store }, null, 2));
}, 1000);
