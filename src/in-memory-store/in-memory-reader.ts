import {
  Message, MessageStoreReader, project, Projection,
} from '..';
import { InMemoryStore } from './store';
import InvalidStreamError from '../errors/invalid-stream';

/**
 * NOTE: This provides a simple stand in for an actual instance of MessageDB either directly
 * or via a Proxy. This implementation IS NOT production ready and should be treated
 * as such. However, it can provide a lightweight, self-contained store to test against.
 */
export class InMemoryReader implements MessageStoreReader {
  private inMemoryStore: InMemoryStore;

  constructor(store?: InMemoryStore) {
    this.inMemoryStore = store || new InMemoryStore();
  }

  // FIXME: NOTE: Fetch will only work on streams with fewer than a 1000 messages. We may come back
  // and fix this if needed in the future.
  async fetch<State>(streamName: string, projection: Projection<State, any>): Promise<State> {
    const messages = await this.getStreamMessages(streamName, 0, 1000);
    const entity: State = project(messages, projection);

    return entity;
  }
  // FIXME: getLastMessage will not work if the stream is a category stream.
  // Not fixing this now as it likely isn't a valid use case to begin with.
  getLastMessage(streamName: string): Promise<Message<any> | null> {
    const isCategoryStream = !streamName.includes('-');
    const category = streamName.split('-')[0];

    if (isCategoryStream) {
      throw new InvalidStreamError('Category streams are not supported in getLastMessage');
    }

    if (
      !this.inMemoryStore.hasCategory(category)
      || !this.inMemoryStore.hasEntityStream(streamName)
    ) {
      return Promise.resolve(null);
    }

    const currentStream = this.inMemoryStore.store[category][streamName];
    const lastMessage = currentStream.slice(
      currentStream.length - 1,
      currentStream.length,
    )[0];

    return Promise.resolve(lastMessage);
  }

  getStreamMessages(
    streamName: string,
    fromPosition?: number,
    batchSize?: number,
  ): Promise<Message<any>[]> {
    // Needs to get entity stream and category stream
    // In the case of entity streams, we can just return the values of the stream.
    // In the case of category streams, we'll need to get all messages from a category,
    // sort them by global position, then extract the proper batch size using the fromPosition
    // Extract the category

    // Determine if we're getting an entity stream or a category stream
    const isCategoryStream = !streamName.includes('-');
    const category = streamName.split('-')[0];

    if (isCategoryStream) {
      // Determine if we have any messages in that category
      if (!this.inMemoryStore.hasCategory(category)) {
        return Promise.resolve([]);
      }

      // return the correct batch based on `position` and `batchSize`

      // Get all the streams from that category and gather all respective messages
      const messages: Message<any>[] = [];
      Object.entries(this.inMemoryStore.store[category]).forEach(([, msgs]) => {
        messages.push(...msgs);
      });

      // Sort the messages based on global position
      messages.sort((a, b) => a.globalPosition! - b.globalPosition!);

      const sliceFrom = fromPosition ? fromPosition - 1 : 0;
      const sliceTo = batchSize ? sliceFrom + batchSize : 100;
      const batch = messages.slice(sliceFrom, sliceTo);

      return Promise.resolve(batch);
    }

    // We're getting an entity stream
    // Determine if the stream exists
    if (
      !this.inMemoryStore.hasCategory(category)
      || !this.inMemoryStore.hasEntityStream(streamName)
    ) {
      // We don't have any messages for that stream

      return Promise.resolve([]);
    }

    // We have some messages in the entity stream
    const sliceFrom = fromPosition || 0;
    const sliceTo = batchSize ? sliceFrom + batchSize : 100;

    const batch = this.inMemoryStore.store[category][streamName].slice(
      sliceFrom,
      sliceTo,
    );

    return Promise.resolve(batch);
  }
}
