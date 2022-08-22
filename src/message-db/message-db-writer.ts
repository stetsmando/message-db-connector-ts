import {
  Message,
  MessageStoreWriter,
} from '..';
import { DB, DBOptions } from './db';

import InvalidExpectedVersionError from '../errors/invalid-expected-version';
import DuplicateKeyError from '../errors/duplicate-key';

const DEFAULT_CONNECTION_STRING = 'postgresql://message_store@localhost:5432/message_store';
const WRITE_MESSAGE_SQL = 'SELECT write_message($1, $2, $3, $4, $5, $6)';

type PossibleErrors = Error | InvalidExpectedVersionError | DuplicateKeyError;

export class MessageDbWriter implements MessageStoreWriter {
  private db!: DB;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static async Make(options: DBOptions) {
    const me = new MessageDbWriter();

    me.db = await DB.Make({
      connectionString: options.connectionString || DEFAULT_CONNECTION_STRING,
    });

    return me;
  }

  async write(message: Message<any>, expectedVersion?: number | undefined): Promise<Message<any>> {
    const {
      id,
      streamName,
      type,
      data,
      metadata,
    } = message;
    const values = [id, streamName, type, data, metadata, expectedVersion];

    try {
      await this.db.query(WRITE_MESSAGE_SQL, values);
      return message;
    } catch (e: unknown) {
      throw this.whatToThrow(e);
    }
  }

  whatToThrow(error: unknown): PossibleErrors {
    let toThrow: PossibleErrors;

    const { message } = error as Error;
    if (message.includes('Wrong expected version')) {
      toThrow = new InvalidExpectedVersionError();
    } else if (message.includes('duplicate key value violates unique constraint "messages_id"')) {
      toThrow = new DuplicateKeyError();
    } else {
      toThrow = error as Error;
    }

    return toThrow;
  }
}
