import { Message } from './message';
import { Projection } from './projection';

export abstract class MessageStoreReader {
  abstract fetch<State>(streamName: string, projection: Projection<State, any>): Promise<State>;
  abstract getLastMessage(streamName: string): Promise<Message<any> | null>;
  abstract getStreamMessages(
    streamName: string,
    fromPosition?: number,
    batchSize?: number
  ): Promise<Message<any>[]>;
}
