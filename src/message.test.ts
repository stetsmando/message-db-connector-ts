import { randomUUID as uuid } from 'crypto';
import InvalidIdError from './errors/invalid-id';
import InvalidTimeError from './errors/invalid-time';
import { Message, MessageOptions, MetaDataBase } from './message';

interface CustomMessage {
  type: 'CustomMessage'
  data: {
    isAwesome: boolean
  }
}

describe('Message', () => {
  describe('Base', () => {
    it('should construct normally', () => {
      const isoDate = new Date().toISOString();
      const options : MessageOptions<CustomMessage> = {
        id: uuid({ disableEntropyCache: true }),
        streamName: 'customMessage-e1b3ee7c-cafd-465c-80f8-c209d29f481a',
        type: 'CustomMessage',
        data: {
          isAwesome: true,
        },
        metadata: {
          traceId: 'abdb130a-0803-4b8d-a65f-8f575486c62a',
        },
        position: 0,
        globalPosition: 0,
        time: isoDate,
      };

      const message = new Message<CustomMessage>(options);

      expect(message.id).toBe(options.id);
      expect(message.type).toBe(options.type);
      expect(message.streamName).toBe(options.streamName);
      expect(message.data).toBe(options.data);
      expect(message.metadata).toBe(options.metadata);
      expect(message.position).toBe(options.position);
      expect(message.globalPosition).toBe(options.globalPosition);
      expect(message.time).toBe(options.time);
    });

    it('should throw when id isn\'t a uuid v4', () => {
      const options : MessageOptions<CustomMessage> = {
        id: '', // ids should be uuid v4
        streamName: 'customMessage-e53a6242-8a68-4364-8107-c2a567d6f766',
        type: 'CustomMessage',
        data: { isAwesome: true },
        metadata: {
          traceId: 'd14b5090-e9d6-4783-8bed-ea75cc6a4769',
        },
      };

      expect(() => new Message(options)).toThrow(InvalidIdError);
    });

    it('should throw when time isn\'t in the correct format', () => {
      const options : MessageOptions<CustomMessage> = {
        id: '23b11e46-0f1d-4975-8ea6-c2fbe3745683',
        streamName: 'customMessage-e53a6242-8a68-4364-8107-c2a567d6f766',
        type: 'CustomMessage',
        data: { isAwesome: true },
        metadata: {
          traceId: 'd14b5090-e9d6-4783-8bed-ea75cc6a4769',
        },
        time: 'Dec. 4, 1995', // time should be ISO 8601
      };

      expect(() => new Message(options)).toThrow(InvalidTimeError);
    });
  });

  describe('Follow', () => {
    interface Leader {
      type: 'LeaderMessage'
      data: {
        someProp: boolean
        anotherProp: boolean
      }
    }

    it('should follow a simple message successfully', () => {
      interface Follower {
        type: 'Follower',
        data: {
          someProp: boolean
          anotherProp: boolean
        }
      }

      const options: MessageOptions<Leader> = {
        id: 'd6be4dff-cd3e-4ee8-a561-cec3ecc0d8a1',
        streamName: 'follow-393ef873-d86d-4009-ad93-186d6de1862a',
        type: 'LeaderMessage',
        data: {
          someProp: true,
          anotherProp: true,
        },
        metadata: {
          traceId: '3cc09d96-8408-484f-a10f-ae66fd244076',
        },
        position: 10,
        globalPosition: 110,
      };

      const leader = new Message<Leader>(options);
      const follower = leader.follow<Follower>({ type: 'Follower' });
      const expectedMetaData: MetaDataBase = {
        causationMessageStreamName: options.streamName,
        causationMessagePosition: options.position,
        causationMessageGlobalPosition: options.globalPosition,
        traceId: options.metadata.traceId,
      };

      expect(follower.data).toStrictEqual(leader.data);
      expect(follower.metadata).toStrictEqual(expectedMetaData);
    });

    it('should follow a simple message successfully with inclusions', () => {
      interface Follower {
        type: 'Follower',
        data: {
          someProp: boolean
        }
      }

      const options: MessageOptions<Leader> = {
        id: '49a3b0e9-a80d-4058-a13f-579140a452c3',
        streamName: 'follow-514a4535-0ea7-4d4f-8332-6db3df601327',
        type: 'LeaderMessage',
        data: {
          someProp: true,
          anotherProp: true,
        },
        metadata: {
          traceId: '2c01797c-1ab0-4152-9d35-67fbb4e465e1',
        },
        position: 10,
        globalPosition: 110,
      };

      const leader = new Message<Leader>(options);
      const include = new Set(['someProp']);
      const follower = leader.follow<Follower>({
        type: 'Follower',
        streamName: options.streamName,
        include,
      });
      const expectedData: Follower['data'] = {
        someProp: true,
      };
      const expectedMetaData: MetaDataBase = {
        causationMessageStreamName: options.streamName,
        causationMessagePosition: options.position,
        causationMessageGlobalPosition: options.globalPosition,
        traceId: options.metadata.traceId,
      };

      expect(follower.streamName).toBe(options.streamName);
      expect(follower.data).toStrictEqual(expectedData);
      expect(follower.metadata).toStrictEqual(expectedMetaData);
    });

    it('should follow a simple message successfully with exclusions', () => {
      interface Follower {
        type: 'Follower',
        data: {
          someProp: boolean
        }
      }

      const options: MessageOptions<Leader> = {
        id: '49a3b0e9-a80d-4058-a13f-579140a452c3',
        streamName: 'follow-514a4535-0ea7-4d4f-8332-6db3df601327',
        type: 'LeaderMessage',
        data: {
          someProp: true,
          anotherProp: true,
        },
        metadata: {
          traceId: '2c01797c-1ab0-4152-9d35-67fbb4e465e1',
        },
        position: 10,
        globalPosition: 110,
      };

      const leader = new Message<Leader>(options);
      const exclude = new Set(['anotherProp']);
      const follower = leader.follow<Follower>({
        type: 'Follower',
        exclude,
      });
      const expectedData: Follower['data'] = {
        someProp: true,
      };
      const expectedMetaData: MetaDataBase = {
        causationMessageStreamName: options.streamName,
        causationMessagePosition: options.position,
        causationMessageGlobalPosition: options.globalPosition,
        traceId: options.metadata.traceId,
      };

      expect(follower.streamName).toBe(options.streamName);
      expect(follower.data).toStrictEqual(expectedData);
      expect(follower.metadata).toStrictEqual(expectedMetaData);
    });
  });
});
