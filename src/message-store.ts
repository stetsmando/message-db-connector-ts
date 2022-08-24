import {
  Message,
  MessageStoreReader,
  MessageStoreWriter,
  Projection,
  Logger,
  Levels,
} from '.';

export interface MessageStoreOptions {
  reader: MessageStoreReader
  writer: MessageStoreWriter
  logLevel?: Levels
}

export class MessageStore {
  private reader: MessageStoreReader;
  private writer: MessageStoreWriter;
  private logger: Logger;

  constructor(options: MessageStoreOptions) {
    this.reader = options.reader;
    this.writer = options.writer;
    this.logger = options.logLevel
      ? new Logger({ level: options.logLevel })
      : new Logger();

    this.logger.debug('MessageStore::constructor');
  }

  public write(message: Message<any>, expectedVersion?: number): Promise<any> {
    return this.writer.write(message, expectedVersion);
  }

  public fetch<State>(
    streamName: string,
    projection: Projection<State, any>,
  ): Promise<State> {
    return this.reader.fetch<State>(streamName, projection);
  }

  public getLastMessage(streamName: string): Promise<Message<any> | null> {
    return this.reader.getLastMessage(streamName);
  }

  public getStreamMessages(
    streamName: string,
    fromPosition?: number,
    batchSize?: number,
  ):Promise<Message<any>[]> {
    return this.reader.getStreamMessages(streamName, fromPosition, batchSize);
  }
}
