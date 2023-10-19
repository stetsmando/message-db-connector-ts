import { Message } from './message';

// NOTE: MessageType is actually the Message<TYPE>
type ProjectionHandler<State, MessageType> = (state: State, message: MessageType) => State;

export interface Projection<State, MessageType> {
  init: State
  name: string,
  handlers: Record<string, ProjectionHandler<State, MessageType>>
}

export function project<T, K, S>(messages: T[], projection: K): S;
export function project(messages: Message<any>[], projection: Projection<any, any>) {
  const init = structuredClone(projection.init);

  return messages.reduce((state, message: Message<any>) => {
    const { type } = message;

    if (!projection.handlers[type]) {
      return state;
    }

    return projection.handlers[message.type](state, message);
  }, init);
}
