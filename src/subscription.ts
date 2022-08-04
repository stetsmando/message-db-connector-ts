/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { v4 as uuid } from 'uuid';
import { Message, MessageBase } from './message';
import { MessageStore } from './message-store';
import InvalidStreamError from './errors/invalid-stream';

export type MessageHandler<T> = (message: T, context: HandlerContext) => Promise<any>;

export interface HandlerContext {
  // FIXME: Come back and add better log typing when doing the logging pass
  log: (message?: any, ...optionalParams: any[]) => void,
  messageStore: MessageStore
}

export interface Position extends MessageBase {
  type: 'PositionCommitted'
  data: {
    position: number
  }
}

export interface SubscriptionOptions {
  messageStore: MessageStore
  streamName: string
  subscriberId: string
  batchSize?: number
  intervalTimeMs?: number
}

export class Subscription {
  private messageStore: MessageStore;
  private streamName: string;
  private subscriberId: string;
  private handlers: Record<string, MessageHandler<any>>;
  private handlerContext: HandlerContext;
  private batchSize: number;
  private positionUpdateInterval: number;
  private intervalTimeMs: number;

  private subscriberPositionStream: string;
  private currentPosition: number;
  private messagesSinceSave: number;

  private keepPolling: boolean;

  constructor(options: SubscriptionOptions) {
    this.messageStore = options.messageStore;
    this.streamName = options.streamName;
    this.subscriberId = options.subscriberId;
    this.batchSize = options.batchSize || 100;
    this.positionUpdateInterval = this.batchSize;
    this.intervalTimeMs = options.intervalTimeMs || 100;
    this.handlers = {};
    this.handlerContext = {
      log: console.log,
      messageStore: this.messageStore,
    };

    // This is structured to follow the eventide conventions found here:
    // http://docs.eventide-project.org/user-guide/consumers.html#position-store
    this.subscriberPositionStream = `${this.streamName}+position-${this.subscriberId}`;
    this.currentPosition = -1;
    this.messagesSinceSave = 0;
    this.keepPolling = true;

    // We only subscribe to categories, not entity specific streams
    // For example, we'd subscribe to `transactions` but not to
    // `transactions-a4372943-1ae8-4457-87e7-845b89bca54c`
    const isCategorySubscription = !this.streamName.includes('-');
    if (!isCategorySubscription) {
      throw new InvalidStreamError(
        `Subscription stream must be a category. Received:${this.streamName}`,
      );
    }
  }

  public registerHandler<T>(handler: MessageHandler<T>) {
    const { name } = handler;
    this.handlers[name] = handler;
  }

  public async start() {
    this.currentPosition = await this.getSubscriberPosition();
    console.log('current position: ', this.currentPosition);

    // Start polling for messages
    while (this.keepPolling) {
      // Disabling this rule because we want these to happen in sequence and not all at once.
      // eslint-disable-next-line no-await-in-loop
      await this.tick();
      // eslint-disable-next-line no-await-in-loop
      await Subscription.delay(this.intervalTimeMs);
    }
  }

  public signalStop(): void {
    this.keepPolling = false;
  }

  private async getSubscriberPosition(): Promise<number> {
    const positionMessage = await this.messageStore.getLastMessage(
      this.subscriberPositionStream,
    );

    return positionMessage?.data?.position ? positionMessage.data.position : 0;
  }

  private async setSubscriberPosition(position: number): Promise<void> {
    this.currentPosition = position;
    this.messagesSinceSave += 1;

    if (this.messagesSinceSave >= this.positionUpdateInterval) {
      this.messagesSinceSave = 0;

      const positionEvent = new Message<Position>({
        id: uuid(),
        type: 'PositionCommitted',
        streamName: this.subscriberPositionStream,
        data: {
          position: this.currentPosition,
        },
        metadata: {},
      });

      await this.messageStore.write(positionEvent);
    }
  }

  private async tick() {
    const nextBatchOfMessages = await this.messageStore.getStreamMessages(
      this.streamName,
      this.currentPosition + 1,
      this.batchSize,
    );

    for (const message of nextBatchOfMessages) {
      const { type, globalPosition } = message;
      if (this.handlers[type]) {
        await this.handlers[type](message, this.handlerContext);
      }

      await this.setSubscriberPosition(globalPosition!);
    }
  }

  private static delay(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
