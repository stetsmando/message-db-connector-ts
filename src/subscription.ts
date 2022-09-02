/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { v4 as uuid } from 'uuid';
import InvalidStreamError from './errors/invalid-stream';
import {
  Message,
  MessageBase,
  MessageStore,
  Logger,
  Levels,
} from '.';

export type MessageHandler<T> = (message: T, context: HandlerContext) => Promise<any>;

export interface HandlerContext {
  logger: Logger
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
  logLevel?: Levels
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
  private logger: Logger;

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
    this.logger = options.logLevel
      ? new Logger({ level: options.logLevel })
      : new Logger();
    this.handlerContext = {
      logger: this.logger,
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

    this.logger.info(`Subscription::constructor::${this.subscriberId}`);
  }

  public registerHandler<T>(handler: MessageHandler<T>) {
    const { name } = handler;
    this.handlers[name] = handler;
  }

  public async start() {
    this.currentPosition = await this.getSubscriberPosition();
    this.logger.info(`Subscription::start::${this.subscriberId} current position: ${this.currentPosition}`);

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
    this.logger.info(`Subscription::signalStop::${this.subscriberId}`);
    this.keepPolling = false;
  }

  private async getSubscriberPosition(): Promise<number> {
    this.logger.debug(`Subscription::getSubscriberPosition::${this.subscriberId}`);
    const positionMessage = await this.messageStore.getLastMessage(
      this.subscriberPositionStream,
    );

    return positionMessage?.data?.position ? positionMessage.data.position : 0;
  }

  private async setSubscriberPosition(position: number): Promise<void> {
    this.currentPosition = position;
    this.messagesSinceSave += 1;

    this.logger.debug(`Subscription::setSubscriberPosition::${this.subscriberId}, ${position}`);

    if (this.messagesSinceSave >= this.positionUpdateInterval) {
      this.logger.debug(`Subscription::setSubscriberPosition::${this.subscriberId} committing position`);
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
    this.logger.verbose(`Subscription::tick::${this.subscriberId}`);
    const nextBatchOfMessages = await this.messageStore.getStreamMessages(
      this.streamName,
      this.currentPosition + 1,
      this.batchSize,
    );

    for (const message of nextBatchOfMessages) {
      const { id, type, globalPosition } = message;
      this.logger.debug(`Subscription::tick::${this.subscriberId} ${type}:${id}`);
      if (this.handlers[type]) {
        this.logger.debug(`Subscription::tick::${this.subscriberId} ${type}:${id} Found Handler`);
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
