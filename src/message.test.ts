import { v4 as uuid } from 'uuid';
import InvalidIdError from './errors/invalid-id';
import InvalidTimeError from './errors/invalid-time';
import { Message, MessageOptions } from './message';

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
        id: uuid(),
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
});
