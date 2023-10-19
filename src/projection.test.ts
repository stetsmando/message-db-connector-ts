import { randomUUID as uuid } from 'crypto';

import { Message, MessageBase } from '.';
import { project, Projection } from './projection';

interface CustomMessage extends MessageBase {
  type: 'CustomMessage'
  data: {
    firstName: string
    lastName: string
  }
}

interface AnotherOne extends MessageBase {
  type: 'AnotherOne'
  data: {
    isDj: boolean
  }
}

type AllMessages = CustomMessage | AnotherOne;

describe('Projection', () => {
  it('should project instanced messages', () => {
    const firstName = 'John';
    const lastName = 'Doe';
    const messages : Message<AllMessages>[] = [
      new Message<CustomMessage>({
        id: uuid({ disableEntropyCache: true }),
        type: 'CustomMessage',
        streamName: `someCategory-${uuid({ disableEntropyCache: true })}`,
        data: {
          firstName,
          lastName,
        },
        metadata: {},
      }),
      new Message<AnotherOne>({
        id: uuid({ disableEntropyCache: true }),
        type: 'AnotherOne',
        streamName: `someCategory-${uuid({ disableEntropyCache: true })}`,
        data: {
          isDj: true,
        },
        metadata: {},
      }),
    ];

    interface State {
      name?: string
      isDj?: boolean
    }

    const projection : Projection<State, Message<any>> = {
      init: {},
      name: 'myCustomProjection',
      handlers: {
        CustomMessage(state: State, message: Message<CustomMessage>) {
          if (state.name) { return state; }

          // eslint-disable-next-line @typescript-eslint/no-shadow
          const { data: { firstName, lastName } } = message;

          return { name: `${firstName}${lastName}` };
        },
        AnotherOne(state: State, message: Message<AnotherOne>) {
          if (state.isDj) { return state; }

          const { data: { isDj } } = message;

          return { ...state, isDj };
        },
      },
    };

    const expectedResults = {
      name: `${firstName}${lastName}`,
      isDj: true,
    };

    expect(project(messages, projection)).toStrictEqual(expectedResults);
  });

  it('should project non instanced messages', () => {
    const streamName = `someCategory-${uuid({ disableEntropyCache: true })}`;

    const messages: Message<any>[] = [
      JSON.parse(JSON.stringify(new Message<AnotherOne>({
        id: uuid({ disableEntropyCache: true }),
        type: 'AnotherOne',
        streamName,
        data: {
          isDj: true,
        },
        metadata: {},
        position: 0,
        globalPosition: 0,
        time: new Date().toISOString(),
      }))),
      JSON.parse(JSON.stringify(new Message<AnotherOne>({
        id: uuid({ disableEntropyCache: true }),
        type: 'AnotherOne',
        streamName,
        data: {
          isDj: false,
        },
        metadata: {},
        position: 1,
        globalPosition: 1,
        time: new Date().toISOString(),
      }))),
    ];

    interface State {
      toggle: boolean
    }

    const projection : Projection<State, Message<any>> = {
      init: { toggle: true },
      name: 'myCustomProjection',
      handlers: {
        AnotherOne(_state: State, message: Message<AnotherOne>) {
          const { data: { isDj } } = message;

          return { toggle: isDj };
        },
      },
    };

    expect(project(messages, projection)).toStrictEqual({
      toggle: false,
    });
  });

  it('Should reset initial projection value to avoid mutative bugs', () => {
    interface InitialMessage extends MessageBase {
      type: 'InitialMessage'
      data: {
        numberOfThings: number
      }
    }

    interface SubsequentMessage extends MessageBase {
      type: 'SubsequentMessage'
      data: {}
    }

    const streamId1 = uuid({ disableEntropyCache: true });
    const streamId2 = uuid({ disableEntropyCache: true });

    const initialMessage1Id = '92de190d-9993-42e7-9064-8e8051c9660d';
    const subsequentMessage1Id = '961d4900-a59f-450f-9bc9-ddfbbe1f7e4f';
    const initialMessage2Id = 'cf43dd94-230b-4ea6-8f71-de0312014757';
    const subsequentMessage2Id = '6d5e116e-7ce2-4a7b-9043-e064060e83f3';

    const messages1: Message<any>[] = [
      new Message<InitialMessage>({
        id: initialMessage1Id,
        type: 'InitialMessage',
        streamName: `projectionTests-${streamId1}`,
        data: {
          numberOfThings: 2,
        },
        metadata: {},
      }),
      new Message<SubsequentMessage>({
        id: subsequentMessage1Id,
        type: 'SubsequentMessage',
        streamName: `projectionTests-${streamId1}`,
        data: {},
        metadata: {},
      }),
    ];

    const messages2: Message<any>[] = [
      new Message<InitialMessage>({
        id: initialMessage2Id,
        type: 'InitialMessage',
        streamName: `projectionTests-${streamId2}`,
        data: {
          numberOfThings: 1,
        },
        metadata: {},
      }),
      new Message<SubsequentMessage>({
        id: subsequentMessage2Id,
        type: 'SubsequentMessage',
        streamName: `projectionTests-${streamId2}`,
        data: {},
        metadata: {},
      }),
    ];

    interface State {
      numberOfThings: number,
      subsequentMessagesSeen: { [key: string]: boolean }
    }

    const projection : Projection<State, Message<any>> = {
      init: {
        numberOfThings: 0,
        subsequentMessagesSeen: {},
      },
      name: 'thingProjection',
      handlers: {
        InitialMessage(thing: State, initialMessage: Message<InitialMessage>) {
          const { data: { numberOfThings } } = initialMessage;

          return {
            ...thing,
            numberOfThings,
          };
        },
        SubsequentMessage(thing: State, subsequentMessage: Message<SubsequentMessage>) {
          const { subsequentMessagesSeen } = thing;
          const { id } = subsequentMessage;

          subsequentMessagesSeen[id] = true;

          return {
            ...thing,
            subsequentMessagesSeen,
          };
        },
      },
    };

    const expectedResults1: State = {
      numberOfThings: 2,
      subsequentMessagesSeen: {
        [subsequentMessage1Id]: true,
      },
    };

    const expectedResults2: State = {
      numberOfThings: 1,
      subsequentMessagesSeen: {
        [subsequentMessage2Id]: true,
      },
    };

    expect(project(messages1, projection)).toEqual(expectedResults1);
    expect(project(messages2, projection)).toEqual(expectedResults2);
  });
});
