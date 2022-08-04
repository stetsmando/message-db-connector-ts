import { Message } from './message';

export abstract class MessageStoreWriter {
  abstract write(
    message: Message<any>,
    expectedVersion?: number
  ): Promise<Message<any>>;
}
