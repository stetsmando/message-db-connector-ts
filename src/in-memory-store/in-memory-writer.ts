import { Message, MessageStoreWriter } from '..';
import VersionConflictError from '../errors/version-conflict';

import { InMemoryStore } from './store';

/**
 * NOTE: This provides a simple stand in for an actual instance of MessageDB either directly
 * or via a Proxy. This implementation IS NOT production ready and should be treated
 * as such. However, it can provide a lightweight, self-contained store to test against.
 */
export class InMemoryWriter implements MessageStoreWriter {
  private inMemoryStore: InMemoryStore;

  constructor(store?: InMemoryStore) {
    this.inMemoryStore = store || new InMemoryStore();
  }

  public write(
    message: Message<any>,
    expectedVersion?: number,
  ) : Promise<Message<any>> {
    const incoming : Message<any> = { ...message };

    // Extract the category from the stream name
    const { streamName } = incoming;
    const category = streamName.split('-')[0];

    // Check to see if we have any messages for that stream name
    if (!this.inMemoryStore.store[category] || !this.inMemoryStore.store[category][streamName]) {
      // We don't have an entry for this yet
      // Update the message positions
      incoming.globalPosition = this.inMemoryStore.globalPosition;
      incoming.position = 0;

      // Capture the write time
      incoming.time = new Date().toISOString();

      // Put it in the 'store'
      if (!this.inMemoryStore.store[category]) {
        this.inMemoryStore.store[category] = {};
      }
      this.inMemoryStore.store[category][streamName] = [{ ...incoming }];
    } else {
      // We have messages already
      const currentStream : Message<any>[] = this.inMemoryStore.store[category][streamName];

      // Check for an expected version conflict
      const lastMessage = currentStream[currentStream.length - 1];
      if (
        (
          !!expectedVersion
          && lastMessage.position! >= expectedVersion
        )
        || (
          expectedVersion === 0
          && lastMessage.position! >= 0
        )
      ) {
        console.log('We have a version conflict');
        throw new VersionConflictError(`Expected ${expectedVersion}, received ${lastMessage.position}`);
      }

      // We don't have a version conflict
      // Update the message's positions
      incoming.globalPosition = this.inMemoryStore.globalPosition;
      incoming.position = lastMessage.position ? lastMessage.position + 1 : 0;

      // Capture the write time
      incoming.time = new Date().toISOString();

      // Write the message
      currentStream.push(incoming);
    }

    // Increment our global position
    this.inMemoryStore.globalPosition++;

    return Promise.resolve(incoming);
  }
}
