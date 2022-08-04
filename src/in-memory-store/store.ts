import { Message } from '..';

// Example of what a Store might look like:
// {
//   transaction: {
//     'transaction-e8ab5274-fab0-4ee4-9257-181bc53dd073': [
//       ...Message<any>...
//     ],
//     'transaction-90940967-a360-4771-a8a8-7143d1dc04bf': [
//       ...Message<any>...
//     ],
//   },
//   'transaction:command': {
//     ...
//   }
// }

export type MessageRecord = Record<string, Message<any>[]>;
export type Store = Record<string, MessageRecord>;

export class InMemoryStore {
  public globalPosition: number = 1;
  public store: Store = {};

  public hasCategory(category: string): boolean {
    return !!this.store[category];
  }

  public hasEntityStream(stream: string): boolean {
    const category = stream.split('-')[0];
    return this.hasCategory(category) && !!this.store[category][stream];
  }
}
