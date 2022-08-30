import { v4 as uuid } from 'uuid';
import { Message, Levels } from '..';
import { DB, MessageDbWriter } from '.';
import InvalidExpectedVersionError from '../errors/invalid-expected-version';
import DuplicateKeyError from '../errors/duplicate-key';

const connectionString = 'postgresql://message_store@localhost:5432/message_store';
const readSql = 'SELECT * FROM messages WHERE id=$1';

describe('MessageDB Writer', () => {
  describe('write', () => {
    it('should write a message to the database', async () => {
      const db = await DB.Make({ connectionString });
      const writer = await MessageDbWriter.Make({
        connectionString,
        logLevel: Levels.Debug,
      });

      interface TestMessage {
        type: 'TestMessage'
        data: {
          isTest: boolean
        }
      }

      const id = uuid();
      const category = `streamReadTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${id}`;

      const testMessage = new Message<TestMessage>({
        id,
        streamName,
        type: 'TestMessage',
        data: { isTest: true },
        metadata: {},
      });

      await writer.write(testMessage);

      const queryResult = await db.query(readSql, [id]);
      const result = queryResult.rows[0];

      expect(result).toBeTruthy();
      expect(result.id).toBe(id);
      expect(result.stream_name).toBe(testMessage.streamName);
      expect(result.type).toBe(testMessage.type);
      expect(result.data).toEqual(testMessage.data);
      expect(result.metadata).toEqual(testMessage.metadata);
    });

    it('should write a message to the database with a proper expected version', async () => {
      const db = await DB.Make({ connectionString });
      const writer = await MessageDbWriter.Make({ connectionString });

      interface TestMessage {
        type: 'TestMessage'
        data: {
          isTest: boolean
        }
      }

      const id = uuid();

      // NOTE: If you're writing the first message to a stream expected version needs to be
      // -1, however, the value that actually gets written is 0. It's weird, but is what it is.
      const writeExpectedVersion = -1;
      const actualExpectedVersion = 0;
      const category = `streamReadTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${id}`;

      const testMessage = new Message<TestMessage>({
        id,
        streamName,
        type: 'TestMessage',
        data: { isTest: true },
        metadata: {},
      });

      await writer.write(testMessage, writeExpectedVersion);

      const queryResult = await db.query(readSql, [id]);
      const result = queryResult.rows[0];

      expect(result).toBeTruthy();
      expect(result.id).toBe(id);
      expect(result.stream_name).toBe(testMessage.streamName);
      expect(result.type).toBe(testMessage.type);
      expect(result.data).toEqual(testMessage.data);
      expect(result.metadata).toEqual(testMessage.metadata);
      expect(parseInt(result.position, 10)).toEqual(actualExpectedVersion);
    });

    it('should throw when improper expected version is given', async () => {
      const writer = await MessageDbWriter.Make({ connectionString });

      interface TestMessage {
        type: 'TestMessage'
        data: {
          isTest: boolean
        }
      }

      const id = uuid();
      const invalidExpectedVersion = 100;
      const category = `streamReadTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${id}`;

      const testMessage = new Message<TestMessage>({
        id,
        streamName,
        type: 'TestMessage',
        data: { isTest: true },
        metadata: {},
      });

      try {
        await writer.write(testMessage, invalidExpectedVersion);
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidExpectedVersionError);
      }
    });

    it('should throw when an message id already exists', async () => {
      const writer = await MessageDbWriter.Make({ connectionString });

      interface TestMessage {
        type: 'TestMessage'
        data: {
          isTest: boolean
        }
      }

      const id = uuid();
      const category = `streamReadTest${Math.random().toString().substring(0, 6)}`;
      const streamName = `${category}-${id}`;

      const testMessage = new Message<TestMessage>({
        id,
        streamName,
        type: 'TestMessage',
        data: { isTest: true },
        metadata: {},
      });

      await writer.write(testMessage);

      try {
        await writer.write(testMessage);
      } catch (e) {
        expect(e).toBeInstanceOf(DuplicateKeyError);
      }
    });
  });
});
