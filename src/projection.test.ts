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
});
