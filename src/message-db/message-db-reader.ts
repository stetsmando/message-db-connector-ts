import {
  Logger,
  Message,
  MessageStoreReader,
  project,
  Projection,
} from '..';
import { DB, DBOptions } from './db';

const DEFAULT_CONNECTION_STRING = 'postgresql://message_store@localhost:5432/message_store';
const GET_CATEGORY_MESSAGES_SQL = 'SELECT * FROM get_category_messages($1, $2, $3)';
const GET_STREAM_MESSAGES_SQL = 'SELECT * FROM get_stream_messages($1, $2, $3)';
const GET_LAST_MESSAGE_SQL = 'SELECT * FROM get_last_stream_message($1)';

interface RawMessage {
  id: string
  stream_name: string
  type: string
  position: string
  global_position: string
  data: string
  metadata: string
  time: Date
}

export class MessageDbReader implements MessageStoreReader {
  db!: DB;
  logger!: Logger;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  static async Make(options: DBOptions) {
    const me = new MessageDbReader();
    me.logger = options.logLevel
      ? new Logger({ level: options.logLevel })
      : new Logger();

    me.db = options.logLevel
      ? await DB.Make({
        pgConnectionConfig: {
          connectionString: DEFAULT_CONNECTION_STRING,
        },
        logLevel: options.logLevel,
      })
      : await DB.Make({
        pgConnectionConfig: {
          connectionString: DEFAULT_CONNECTION_STRING,
        },
      });

    me.logger.debug('MessageDbReader::Make');
    return me;
  }

  async fetch<State>(streamName: string, projection: Projection<State, any>): Promise<State> {
    this.logger.debug(`MessageDbReader::fetch ${projection.name} @${streamName}`);
    const messages = await this.getStreamMessages(streamName);
    const entity : State = await project(messages, projection);

    return entity;
  }

  async getLastMessage(streamName: string): Promise<Message<any> | null> {
    this.logger.debug(`MessageDbReader::getLastMessage::${streamName}`);
    const rawResults = await this.db.query(GET_LAST_MESSAGE_SQL, [streamName]);

    if (rawResults.rowCount <= 0) {
      return null;
    }

    return this.deserialize(rawResults.rows[0]);
  }

  async getStreamMessages(
    streamName: string,
    fromPosition?: number | undefined,
    batchSize?: number | undefined,
  ): Promise<Message<any>[]> {
    this.logger.debug(`MessageDbReader::getStreamMessages::${streamName} fromPosition${fromPosition} batchSize${batchSize}`);
    // NOTE: We can do the following because of the MessageDb conventions surrounding stream names.
    // Read more here: http://docs.eventide-project.org/core-concepts/streams/stream-names.html
    const isCategoryStream = !streamName.includes('-');
    const sql = isCategoryStream ? GET_CATEGORY_MESSAGES_SQL : GET_STREAM_MESSAGES_SQL;
    const values = [streamName, fromPosition, batchSize];

    const rawResults = await this.db.query(sql, values);

    return rawResults.rows.map(this.deserialize, this);
  }

  deserialize(rawMessage : RawMessage) : Message<any> {
    this.logger.debug(`MessageDbReader::deserialize::${rawMessage}`);
    return new Message({
      id: rawMessage.id,
      streamName: rawMessage.stream_name,
      type: rawMessage.type,
      // node-postgres auto parses 'date' columns into Date objects.
      // See https://node-postgres.com/features/types#date--timestamp--timestamptz
      time: rawMessage.time.toISOString(),
      // NOTE: I believe there shouldn't be a reason why 'data' and 'metadata' are null.
      // Will need to keep an eye on this just in case.
      data: JSON.parse(rawMessage.data),
      metadata: JSON.parse(rawMessage.metadata),
      position: parseInt(rawMessage.position, 10),
      globalPosition: parseInt(rawMessage.global_position, 10),
    });
  }
}
