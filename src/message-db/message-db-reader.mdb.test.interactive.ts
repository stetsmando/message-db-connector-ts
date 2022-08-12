import { v4 as uuid } from 'uuid';
import { DB, MessageDbReader } from '.';

describe('MessageDB Reader', () => {
  describe('getStreamMessages', () => {
    it('should return all category messages, ordered correctly', async () => {
      const connectionString = 'postgresql://message_store@localhost:5432/message_store';
      const db = await DB.Make({ connectionString });

      const writeSql = 'SELECT write_message($1, $2, $3, $4, $5, $6)';

      const streamName = `messageReadTest-${uuid()}`;
      const writeMessage1 = {
        id: uuid(),
        type: 'TestEvent1',
      };
      const writeMessage2 = {
        id: uuid(),
        type: 'TestEvent2',
      };
      const writeMessages = [writeMessage1, writeMessage2];

      for (const writeMessage of writeMessages) {
        const writeResult = await db.query(writeSql, [writeMessage.id, streamName, writeMessage.type, {}, {}, null]);
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
  });
});