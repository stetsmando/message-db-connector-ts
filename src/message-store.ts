import { Message } from './message';
import { MessageStoreWriter } from './message-store-writer';
import { MessageStoreReader } from './message-store-reader';
import { Projection } from './projection';

export interface MessageStoreOptions {
  reader: MessageStoreReader
  writer: MessageStoreWriter
}

export class MessageStore {
  private reader: MessageStoreReader;
  private writer: MessageStoreWriter;

  constructor(options: MessageStoreOptions) {
    this.reader = options.reader;
    this.writer = options.writer;
  }

  // TODO: Add support for multi message writing
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
