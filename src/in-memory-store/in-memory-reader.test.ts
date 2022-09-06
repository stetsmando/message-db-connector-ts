import { randomUUID as uuid } from 'crypto';

import { InMemoryReader } from './in-memory-reader';
import { InMemoryStore } from './store';
import { Message, Projection } from '..';

interface Debit {
  type: 'Debit',
  data: { amount: number }
}

interface Deposit {
  type: 'Deposit',
  data: { amount: number }
}

describe('In memory reader', () => {
  describe('fetch', () => {
    it('should successfully fetch an entity', async () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'transactions';
      const streamName = `${category}-${uuid({ disableEntropyCache: true })}`;

      const msg1 = new Message<Deposit>({
        id: uuid({ disableEntropyCache: true }),
        type: 'Deposit',
        streamName,
        data: { amount: 100 },
        metadata: {},
        position: 0,
        globalPosition: 1,
        time: new Date().toISOString(),
      });
      const msg2 = new Message<Deposit>({
        id: uuid({ disableEntropyCache: true }),
        type: 'Deposit',
        streamName,
        data: { amount: 50 },
        metadata: {},
        position: 1,
        globalPosition: 2,
        time: new Date().toISOString(),
      });
      const msg3 = new Message<Debit>({
        id: uuid({ disableEntropyCache: true }),
        type: 'Debit',
        streamName,
        data: { amount: 75 },
        metadata: {},
        position: 2,
        globalPosition: 3,
        time: new Date().toISOString(),
      });

      inMemoryStore.globalPosition = 4; // Manually setting this because not using write()
      inMemoryStore.store = {
        [category]: {
          [streamName]: [msg1, msg2, msg3],
        },
      };

      const reader = new InMemoryReader(inMemoryStore);

      interface State {
        balance: number,
      }

      const projection: Projection<State, Message<any>> = {
        init: { balance: 0 },
        name: 'accountBalance',
        handlers: {
          Debit(state: State, message: Message<Debit>) {
            const { balance } = state;
            const { data: { amount } } = message;

            return { balance: balance - amount };
          },
          Deposit(state: State, message: Message<Deposit>) {
            const { balance } = state;
            const { data: { amount } } = message;

            return { balance: balance + amount };
          },
        },
      };

      expect(await reader.fetch(streamName, projection)).toStrictEqual({ balance: 75 });
    });
  });

  describe('getLastMessage', () => {
    it('should get the correct last message', async () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'transactions';
      const streamName = `${category}-${uuid({ disableEntropyCache: true })}`;

      const msg1 = new Message<Deposit>({
        id: uuid({ disableEntropyCache: true }),
        type: 'Deposit',
        streamName,
        data: { amount: 100 },
        metadata: {},
        position: 0,
        globalPosition: 1,
        time: new Date().toISOString(),
      });

      const msg2 = new Message<Deposit>({
        id: uuid({ disableEntropyCache: true }),
        type: 'Deposit',
        streamName,
        data: { amount: 150 },
        metadata: {},
        position: 1,
        globalPosition: 2,
        time: new Date().toISOString(),
      });

      inMemoryStore.globalPosition = 3; // Manually setting this because not using write()
      inMemoryStore.store = {
        [category]: {
          [streamName]: [msg1, msg2],
        },
      };

      const reader = new InMemoryReader(inMemoryStore);
      expect(await reader.getLastMessage(streamName)).toStrictEqual(msg2);
    });
    it('should return null', async () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'transactions';
      const streamName = `${category}-${uuid({ disableEntropyCache: true })}`;

      const reader = new InMemoryReader(inMemoryStore);
      expect(await reader.getLastMessage(streamName)).toStrictEqual(null);
    });
  });

  describe('getStreamMessages', () => {
    describe('entity streams', () => {
      it('should return the correct messages', async () => {
        const inMemoryStore = new InMemoryStore();
        const category = 'transactions';
        const streamName = `${category}-${uuid({ disableEntropyCache: true })}`;

        const msg1 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName,
          data: { amount: 100 },
          metadata: {},
          position: 0,
          globalPosition: 1,
          time: new Date().toISOString(),
        });
        const msg2 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName,
          data: { amount: 50 },
          metadata: {},
          position: 1,
          globalPosition: 2,
          time: new Date().toISOString(),
        });

        inMemoryStore.globalPosition = 3; // Manually setting this because not using write()
        inMemoryStore.store[category] = {
          [streamName]: [msg1, msg2],
        };

        const reader = new InMemoryReader(inMemoryStore);
        const messages = await reader.getStreamMessages(streamName);
        expect(messages).toStrictEqual([msg1, msg2]);
      });

      it('should return an empty array', async () => {
        interface Simple {
          type: 'Simple',
          data: {},
        }

        const category = 'transactions';
        const streamName = `${category}-${uuid({ disableEntropyCache: true })}`;
        const msg = new Message<Simple>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Simple',
          data: {},
          metadata: {},
          streamName: `${category}-${uuid({ disableEntropyCache: true })}`,
          position: 0,
          globalPosition: 1,
          time: new Date().toISOString(),
        });
        const inMemoryStore = new InMemoryStore();
        inMemoryStore.store = {
          transactions: {
            [`transactions-${uuid({ disableEntropyCache: true })}`]: [msg],
          },
        };
        inMemoryStore.globalPosition = 2; // Manually setting this because not using write()
        const reader = new InMemoryReader(inMemoryStore);

        expect(await reader.getStreamMessages(streamName)).toStrictEqual([]);
      });
    });
    describe('category streams', () => {
      it('should return all category messages, order correctly', async () => {
        const category = 'transactions';
        const stream1 = `${category}-${uuid({ disableEntropyCache: true })}`;
        const stream2 = `${category}-${uuid({ disableEntropyCache: true })}`;
        const stream3 = `${category}-${uuid({ disableEntropyCache: true })}`;

        const msg1 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream1,
          data: { amount: 100 },
          metadata: {},
          position: 0,
          globalPosition: 1,
          time: new Date().toISOString(),
        });

        const msg2 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream2,
          data: { amount: 75 },
          metadata: {},
          position: 0,
          globalPosition: 2,
          time: new Date().toISOString(),
        });

        const msg3 = new Message<Debit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Debit',
          streamName: stream1,
          data: { amount: 50 },
          metadata: {},
          position: 1,
          globalPosition: 3,
          time: new Date().toISOString(),
        });

        const msg4 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream3,
          data: { amount: 5 },
          metadata: {},
          position: 0,
          globalPosition: 4,
          time: new Date().toISOString(),
        });

        const inMemoryStore = new InMemoryStore();
        inMemoryStore.globalPosition = 5; // Manually setting this because not using write()
        inMemoryStore.store = {
          [category]: {
            [stream1]: [msg1, msg3],
            [stream2]: [msg2],
            [stream3]: [msg4],
          },
        };

        const reader = new InMemoryReader(inMemoryStore);
        expect(await reader.getStreamMessages(category)).toStrictEqual([msg1, msg2, msg3, msg4]);
      });

      it('should return some category messages, order correctly', async () => {
        const category = 'transactions';
        const stream1 = `${category}-${uuid({ disableEntropyCache: true })}`;
        const stream2 = `${category}-${uuid({ disableEntropyCache: true })}`;
        const stream3 = `${category}-${uuid({ disableEntropyCache: true })}`;

        const msg1 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream1,
          data: { amount: 100 },
          metadata: {},
          position: 0,
          globalPosition: 1,
          time: new Date().toISOString(),
        });

        const msg2 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream2,
          data: { amount: 75 },
          metadata: {},
          position: 0,
          globalPosition: 2,
          time: new Date().toISOString(),
        });

        const msg3 = new Message<Debit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Debit',
          streamName: stream1,
          data: { amount: 50 },
          metadata: {},
          position: 1,
          globalPosition: 3,
          time: new Date().toISOString(),
        });

        const msg4 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream3,
          data: { amount: 5 },
          metadata: {},
          position: 0,
          globalPosition: 4,
          time: new Date().toISOString(),
        });

        const inMemoryStore = new InMemoryStore();
        inMemoryStore.globalPosition = 5; // Manually setting this because not using write()
        inMemoryStore.store = {
          [category]: {
            [stream1]: [msg1, msg3],
            [stream2]: [msg2],
            [stream3]: [msg4],
          },
        };

        const reader = new InMemoryReader(inMemoryStore);
        expect(await reader.getStreamMessages(category, 0, 2)).toStrictEqual([msg1, msg2]);
      });

      it('should not return anything if category is empty', async () => {
        const unpopulatedCategory = 'notTransactions';
        const populatedCategory = 'transactions';
        const stream = `${populatedCategory}-${uuid({ disableEntropyCache: true })}`;

        const msg1 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream,
          data: { amount: 100 },
          metadata: {},
          position: 0,
          globalPosition: 1,
          time: new Date().toISOString(),
        });

        const msg2 = new Message<Deposit>({
          id: uuid({ disableEntropyCache: true }),
          type: 'Deposit',
          streamName: stream,
          data: { amount: 75 },
          metadata: {},
          position: 1,
          globalPosition: 2,
          time: new Date().toISOString(),
        });

        const inMemoryStore = new InMemoryStore();
        inMemoryStore.globalPosition = 3; // Manually setting this because not using write()
        inMemoryStore.store = {
          [populatedCategory]: {
            [stream]: [msg1, msg2],
          },
        };

        const reader = new InMemoryReader(inMemoryStore);
        expect(await reader.getStreamMessages(unpopulatedCategory)).toStrictEqual([]);
      });
    });
  });
});
