import { v4 as uuid } from 'uuid';
import { Projection, Message } from '..';
import { DB, MessageDbReader } from '.';

const writeSql = 'SELECT write_message($1, $2, $3, $4, $5, $6)';
const connectionString = 'postgresql://message_store@localhost:5432/message_store';

describe('MessageDB Reader', () => {
  describe('getStreamMessages', () => {
    it('should return all stream messages, ordered correctly', async () => {
      const db = await DB.Make({ pgConnectionConfig: { connectionString } });
      const reader = await MessageDbReader.Make({
        pgConnectionConfig: {
          connectionString,
        },
      });

      const category = `streamReadTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${uuid()}`;
      const otherStreamName = `${category}-${uuid()}`;
      const writeMessage1 = {
        streamName,
        id: uuid(),
        type: 'TestEvent1',
      };
      const writeMessage2 = {
        streamName,
        id: uuid(),
        type: 'TestEvent2',
      };
      const writeMessage3 = {
        streamName: otherStreamName,
        id: uuid(),
        type: 'TestEvent1',
      };
      const writeMessages = [writeMessage1, writeMessage2, writeMessage3];

      for (const writeMessage of writeMessages) {
        const writeResult = await db.query(writeSql, [writeMessage.id, writeMessage.streamName, writeMessage.type, {}, {}, null]);
        if (writeResult?.rowCount !== 1) {
          process.exit(1);
        }
      }

      const [result1, result2] = await reader.getStreamMessages(streamName);

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();

      expect(result1.id).toEqual(writeMessage1.id);
      expect(result1.type).toEqual(writeMessage1.type);
      expect(result1.position).toEqual(0);

      expect(result2.id).toEqual(writeMessage2.id);
      expect(result2.type).toEqual(writeMessage2.type);
      expect(result2.position).toEqual(1);
    });

    it('should return all category messages, ordered correctly', async () => {
      const db = await DB.Make({ pgConnectionConfig: { connectionString } });
      const reader = await MessageDbReader.Make({
        pgConnectionConfig: {
          connectionString,
        },
      });

      const category = `categoryReadTest${Math.random().toString().substring(0, 6)}`;
      const writeMessage1 = {
        streamName: `${category}-${uuid()}`,
        id: uuid(),
        type: 'TestEvent1',
      };
      const writeMessage2 = {
        streamName: `${category}-${uuid()}`,
        id: uuid(),
        type: 'TestEvent2',
      };
      const writeMessages = [writeMessage1, writeMessage2];

      for (const writeMessage of writeMessages) {
        const writeResult = await db.query(writeSql, [writeMessage.id, writeMessage.streamName, writeMessage.type, {}, {}, null]);
        if (writeResult?.rowCount !== 1) {
          process.exit(1);
        }
      }

      const results = await reader.getStreamMessages(category);

      expect(results.length).toBe(2);

      for (const message of results) {
        switch (message.id) {
          case writeMessage1.id:
            expect(message.id).toEqual(writeMessage1.id);
            expect(message.type).toEqual(writeMessage1.type);
            expect(message.position).toEqual(0);
            expect(message.streamName).toEqual(writeMessage1.streamName);
            break;

          case writeMessage2.id:
            expect(message.id).toEqual(writeMessage2.id);
            expect(message.type).toEqual(writeMessage2.type);
            expect(message.position).toEqual(0);
            expect(message.streamName).toEqual(writeMessage2.streamName);
            break;

          default:
            throw new Error('Should be unreachable');
        }
      }
    });
  });

  describe('getLastMessage', () => {
    it('should return the correct last message', async () => {
      const db = await DB.Make({ pgConnectionConfig: { connectionString } });
      const reader = await MessageDbReader.Make({
        pgConnectionConfig: {
          connectionString,
        },
      });

      const category = `getLastMessageTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${uuid()}`;

      const writeMessage1 = {
        id: uuid(),
        type: 'SomeMessage',
        streamName,
      };
      const writeMessage2 = {
        id: uuid(),
        type: 'SomeMessage',
        streamName,
      };

      const writeMessages = [writeMessage1, writeMessage2];

      for (const writeMessage of writeMessages) {
        const writeResult = await db.query(
          writeSql,
          [writeMessage.id, writeMessage.streamName, writeMessage.type, {}, {}, null],
        );
        if (writeResult?.rowCount !== 1) {
          process.exit(1);
        }
      }

      const lastMessage = await reader.getLastMessage(streamName);

      expect(lastMessage).toBeTruthy();
      expect(lastMessage?.id).toBe(writeMessage2.id);
    });

    it('should return null', async () => {
      const reader = await MessageDbReader.Make({
        pgConnectionConfig: {
          connectionString,
        },
      });
      const category = `getLastMessageTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${uuid()}`;

      const lastMessage = await reader.getLastMessage(streamName);

      expect(lastMessage).toBeNull();
    });
  });

  describe('fetch', () => {
    it('should fetch and hydrate an entity', async () => {
      interface Account {
        id: string | null
        balance: number
      }
      interface Debited {
        type: 'Debited',
        data: {
          amount: number
        }
      }
      interface Deposited {
        type: 'Deposited',
        data: {
          amount: number
        }
      }
      const db = await DB.Make({ pgConnectionConfig: { connectionString } });
      const reader = await MessageDbReader.Make({
        pgConnectionConfig: {
          connectionString,
        },
      });

      const category = `categoryReadTest${Math.random().toString().substring(0, 6)}`;
      const accountId = uuid();
      const streamName = `${category}-${accountId}`;
      const writeMessages = [
        {
          id: uuid(),
          streamName,
          type: 'Deposited',
          data: {
            amount: 100,
          },
        },
        {
          id: uuid(),
          streamName,
          type: 'Debited',
          data: {
            amount: 75,
          },
        },
      ];

      for (const writeMessage of writeMessages) {
        const { id, streamName, type, data } = writeMessage;
        const writeResult = await db.query(writeSql, [id, streamName, type, data, {}, null]);
        if (writeResult?.rowCount !== 1) {
          process.exit(1);
        }
      }

      function streamNameToId(streamName:string) {
        const firstHyphen = streamName.indexOf('-');

        return streamName.substring(firstHyphen + 1);
      }

      const projection : Projection<Account, Message<any>> = {
        init: { id: null, balance: 0 },
        name: 'AccountBalanceProjection',
        handlers: {
          Debited(account: Account, message: Message<Debited>) {
            const id = account.id || streamNameToId(message.streamName);
            return { id, balance: account.balance - message.data.amount };
          },
          Deposited(account: Account, message: Message<Deposited>) {
            const id = account.id || streamNameToId(message.streamName);
            return { id, balance: account.balance + message.data.amount };
          },
        },
      };

      const account = await reader.fetch<Account>(streamName, projection);

      expect(account.id).toBe(accountId);
      expect(account.balance).toBe(25);
    });

    it('should return any empty entity', async () => {
      interface Account {
        id: string | null
        balance: number
      }
      const reader = await MessageDbReader.Make({
        pgConnectionConfig: {
          connectionString,
        },
      });

      const category = `categoryReadTest${Math.random().toString().substring(0, 6)}`;
      const accountId = uuid();
      const streamName = `${category}-${accountId}`;
      const init : Account = {
        id: null,
        balance: 0,
      };

      const projection : Projection<Account, Message<any>> = {
        init,
        name: 'AccountBalanceProjection',
        handlers: {
          Debited() {
            throw new Error('Should be unreachable');
          },
          Deposited() {
            throw new Error('Should be unreachable');
          },
        },
      };

      const account = await reader.fetch<Account>(streamName, projection);

      expect(account).toStrictEqual(init);
    });
  });
});
