import { randomUUID as uuid } from 'crypto';
import { InMemoryWriter } from './in-memory-writer';
import { InMemoryStore } from './store';
import { Message, MessageOptions } from '..';
import VersionConflictError from '../errors/version-conflict';

interface CustomMessage {
  type: 'CustomMessage',
  data: { isAwesome: boolean }
}

describe('In memory writer', () => {
  it('should write a message successfully', async () => {
    const category = 'testingCategory';
    const streamId = uuid({ disableEntropyCache: true });
    const streamName = `${category}-${streamId}`;
    const messageOptions : MessageOptions<CustomMessage> = {
      id: uuid({ disableEntropyCache: true }),
      streamName,
      type: 'CustomMessage',
      data: {
        isAwesome: true,
      },
      metadata: {},
      time: new Date().toISOString(),
    };
    const message = new Message(messageOptions);
    const inMemoryStore = new InMemoryStore();
    const writer = new InMemoryWriter(inMemoryStore);

    const result = await writer.write(message, 0);

    expect(result.position).toBe(0);
    expect(result.globalPosition).toBe(1);
    expect(result.time).toBeTruthy();

    expect(inMemoryStore.store[category][streamName]).not.toBeUndefined();
    expect(inMemoryStore.store[category][streamName].length).toBe(1);
    expect(inMemoryStore.store[category][streamName][0]).toStrictEqual(result);
  });

  it('should throw version conflict errors', async () => {
    const category = 'testingCategory';
    const streamId = uuid({ disableEntropyCache: true });
    const streamName = `${category}-${streamId}`;
    const messageOptions1 : MessageOptions<CustomMessage> = {
      id: uuid({ disableEntropyCache: true }),
      streamName,
      type: 'CustomMessage',
      data: {
        isAwesome: true,
      },
      metadata: {},
      time: new Date().toISOString(),
    };
    const messageOptions2 : MessageOptions<CustomMessage> = {
      id: uuid({ disableEntropyCache: true }),
      streamName,
      type: 'CustomMessage',
      data: {
        isAwesome: true,
      },
      metadata: {},
      time: new Date().toISOString(),
    };
    const successMessage = new Message(messageOptions1);
    const failMessage = new Message(messageOptions2);
    const writer = new InMemoryWriter();

    await writer.write(successMessage, 0);
    expect(() => writer.write(failMessage, 0)).toThrowError(VersionConflictError);
  });
});
