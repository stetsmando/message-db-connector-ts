import { v4 as uuid } from 'uuid';
import { DB, MessageDbReader } from '.';

describe('MessageDB Reader', () => {
  describe('getStreamMessages', () => {
    it('should return all stream messages, ordered correctly', async () => {
      const connectionString = 'postgresql://message_store@localhost:5432/message_store';
      const db = await DB.Make({ connectionString });

      const writeSql = 'SELECT write_message($1, $2, $3, $4, $5, $6)';

      const category = 'streamReadTest';
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

      const reader = await MessageDbReader.Make({
        connectionString,
      });

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
      const connectionString = 'postgresql://message_store@localhost:5432/message_store';
      const db = await DB.Make({ connectionString });

      const writeSql = 'SELECT write_message($1, $2, $3, $4, $5, $6)';

      interface WriteMessage {
        streamName: string
        id: string
        type: string
      }
      const category = `categoryReadTest${Math.random().toString().substring(0, 6)}`;
      const writeMessage1 : WriteMessage = {
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

      const reader = await MessageDbReader.Make({
        connectionString,
      });

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

  });
});
