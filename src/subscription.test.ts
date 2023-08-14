import { randomUUID } from "crypto";
import { InMemoryReader, InMemoryStore, InMemoryWriter } from "./in-memory-store";
import { Message, MessageBase } from "./message";
import { MessageStore } from "./message-store";
import { HandlerContext, Subscription } from "./subscription";

interface CustomMessage {
    type: 'CustomMessage'
    data: {
      isAwesome: boolean
    }
  }
  
  export const delay = (ms: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

  async function processEvents(subs: Subscription) {
    const startSignal = subs.start()
    await delay(200)
    subs.signalStop()
    await startSignal
}
export function getMessage<CustomMessage extends MessageBase>(msg: CustomMessage['type'], streamName: string, data: CustomMessage['data']) {
    return new Message({
        data: data,
        id: randomUUID(),
        metadata: {},
        streamName: streamName,
        type: msg
    });
}

describe('Subscriptions', () => {
    const bookingEntityStream = 'bookings'
    let memoryStore: InMemoryStore;
    let messageStore: MessageStore;
    let capturedMesages: CustomMessage[]
    let subs: Subscription;
    beforeEach(() => {
        memoryStore = new InMemoryStore();
        messageStore = new MessageStore({
            reader: new InMemoryReader(memoryStore),
            writer: new InMemoryWriter(memoryStore)
        });
        capturedMesages = []
        subs = new Subscription({
            messageStore: messageStore,
            streamName: bookingEntityStream,
            subscriberId: 'sub'
        })
        let handler = async (message1: CustomMessage, context: HandlerContext) => {
            capturedMesages.push(message1)
        };
        subs.registerHandler(handler)
        return subs

    })
    it('should start and stop processing messages', async () => {
        const message = getMessage<CustomMessage>('CustomMessage', bookingEntityStream, {isAwesome: true})
        for (const msg of [message]) {
            await messageStore.write(msg);
        }
        await processEvents(subs)
        expect(capturedMesages.length).toBe(1)
    })
})