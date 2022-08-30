// This test will simulate a component running in the wild.
// The situation being tested is if a subscription will detect
// a stimulus command and start a process.

import { v4 as uuid } from 'uuid';
import {
  HandlerContext,
  Levels,
  Message,
  MessageStore,
  MessageDbReader,
  MessageDbWriter,
  Subscription,
} from '..';
import { Projection } from '../projection';

namespace Commands {
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
namespace Events {
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
namespace Entities {
  export interface AccountBalance {
    balance: number
    streamPosition: number
    debits: Record<string, boolean>
    deposits: Record<string, boolean>
  }
}

const accountBalanceProjection: Projection<Entities.AccountBalance, Message<any>> = {
  init: { balance: 0, streamPosition: -1, debits: {}, deposits: {} },
  name: 'AccountBalanceProjection',
  handlers: {
    Debited(account: Entities.AccountBalance, message: Message<Events.Debited>) {
      const { balance, debits, deposits } = account;
      const { id, position, data: { amount } } = message;

      return {
        balance: balance - amount,
        streamPosition: position!,
        debits: { ...debits, [id]: true },
        deposits,
      };
    },
    Deposited(account: Entities.AccountBalance, message: Message<Events.Deposited>) {
      const { balance, debits, deposits } = account;
      const { id, position, data: { amount } } = message;

      return {
        balance: balance + amount,
        streamPosition: position!,
        debits,
        deposits: { ...deposits, [id]: true },
      };
    },
  },
};

const DEFAULT_CONNECTION_STRING = 'postgresql://message_store@localhost:5432/message_store';
const LOG_LEVEL = Levels.Info;
const entity = `subscriptionTest${Math.random().toString().substring(0, 6)}`;
const commandCategory = `${entity}:command`;
const commandSubscriberId = uuid();
const accountId = uuid();
const entityStream = `${entity}-${accountId}`;
const batchSize = 1;
const intervalTimeMs = 100;

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
    streamName: `${entity}-${accountId}`,
    data: {
      accountId,
      firstName,
      lastName,
      time,
    },
    metadata: { ...message.metadata },
  });

  return context.messageStore.write(opened, -1);
}
async function Debit(message: Message<Commands.Debit>, context: HandlerContext): Promise<any | null> {
  const {
    id, type, data: { amount },
  } = message;

  context.logger.info(`Handling ${type} event: ${id}`);

  // First thing we do is run a projection to verify if there are enough funds to approve
  // the debit

  const {
    balance,
    streamPosition,
    debits,
  } = await context.messageStore.fetch<Entities.AccountBalance>(
    entityStream,
    accountBalanceProjection,
  );

  if (debits[id]) {
    // We're in the past and have already processed this message
    return null;
  }

  if (amount > balance) {
    // Funds are too low for the debit, reject
    const debitRejected = new Message<Events.DebitRejected>({
      id: uuid(),
      type: 'DebitRejected',
      streamName: `${entity}-${accountId}`,
      data: {
        reason: 'You broke fool.',
      },
      metadata: { ...message.metadata },
    });

    // NOTE: The streamPosition + 1 gives us concurrence safety. This is because if
    // another instance of this component were to write to that stream our position
    // would no longer be correct and the DB will throw and version conflict error
    return context.messageStore.write(debitRejected, streamPosition);
  }

  // We're good and the money is there
  const debited = new Message<Events.Debited>({
    id: uuid(),
    type: 'Debited',
    streamName: `${entity}-${accountId}`,
    data: {
      amount,
    },
    metadata: { ...message.metadata },
  });

  // NOTE: The streamPosition + 1 gives us concurrence safety. This is because if
  // another instance of this component were to write to that stream our position
  // would no longer be correct and the DB will throw and version conflict error
  return context.messageStore.write(debited, streamPosition);
}

async function Deposit(message: Message<Commands.Deposit>, context: HandlerContext): Promise<void | null> {
  const {
    id, type, data: { amount },
  } = message;

  context.logger.info(`Handling ${type} event: ${id}`);

  const {
    streamPosition,
    deposits,
  } = await context.messageStore.fetch<Entities.AccountBalance>(
    entityStream,
    accountBalanceProjection,
  );

  if (deposits[id]) {
    // We're in the past and have already processed this message
    return null;
  }

  const deposited = new Message<Events.Deposited>({
    id: uuid(),
    type: 'Deposited',
    streamName: entityStream,
    data: { amount },
    metadata: { ...message.metadata },
  });

  return context.messageStore.write(deposited, streamPosition + 1);
}

// Declare out Event handler functions
async function AsyncWrapper() {
  const reader = await MessageDbReader.Make({
    pgConnectionConfig: {
      connectionString: DEFAULT_CONNECTION_STRING,
    },
    logLevel: LOG_LEVEL,
  });
  const writer = await MessageDbWriter.Make({
    pgConnectionConfig: {
      connectionString: DEFAULT_CONNECTION_STRING,
    },
    logLevel: LOG_LEVEL,
  });
  const messageStore = new MessageStore({
    reader,
    writer,
    logLevel: LOG_LEVEL,
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
  commandStreamSubscription.registerHandler<Message<Commands.Deposit>>(Deposit);

  commandStreamSubscription.start();

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
  });

  await writer.write(openCommand);

  const depositCommand = new Message<Commands.Deposit>({
    id: uuid(),
    type: 'Deposit',
    streamName: `${commandCategory}-${accountId}`,
    data: { amount: 100 },
    metadata: { traceId: uuid() },
  });

  await writer.write(depositCommand);

  const firstDebitCommand = new Message<Commands.Debit>({
    id: uuid(),
    streamName: `${commandCategory}-${accountId}`,
    type: 'Debit',
    data: {
      amount: 75,
    },
    metadata: {
      traceId: uuid(),
    },
  });

  await writer.write(firstDebitCommand);

  const secondDebitCommand = new Message<Commands.Debit>({
    id: uuid(),
    streamName: `${commandCategory}-${accountId}`,
    type: 'Debit',
    data: {
      amount: 75,
    },
    metadata: {
      traceId: uuid(),
    },
  });

  await writer.write(secondDebitCommand);
  // setTimeout(() => {
  //   commandStreamSubscription.signalStop();
  // }, 5000);
}

AsyncWrapper();
