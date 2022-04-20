import InvalidIdError from './errors/invalid-id';
import InvalidTimeError from './errors/invalid-time';

export interface MessageBase {
  type: string,
  data: object
}

export interface Message<T extends MessageBase> {
  id: string;
  streamName: string;
  type: T['type'];
  data: T['data'];
  metadata: MetaDataBase;
  position: number | null;
  globalPosition: number | null;
  time: string | null;
}

export interface MessageOptions<T extends MessageBase> {
  id: string
  streamName: string
  type: T['type']
  data: T['data']
  metadata: MetaDataBase
  position?: number
  globalPosition?: number
  time?: string
}

// Descriptions for each of the MetaData fields can be found:
// http://docs.eventide-project.org/user-guide/messages-and-message-data/metadata.html#messaging-message-metadata-class
export interface MetaDataBase {
  causationMessageGlobalPosition?: number
  causationMessagePosition?: number
  causationMessageStreamName?: string
  correlationStreamName?: string
  replyStreamName?: string
  schemaVersion?: string
  traceId?: string
}

export class Message<T extends MessageBase> {
  public id: string;
  public streamName: string;
  public type: T['type'];
  public data: T['data'];
  public metadata: MetaDataBase;
  public position: number | null = null;
  public globalPosition: number | null = null;
  public time: string | null = null;

  constructor(options: MessageOptions<T>) {
    // Validate that the provide options.id is actually a UUID v4
    if (!Message.isUuid(options.id)) { throw new InvalidIdError(); }
    this.id = options.id;

    // Validate that the provided options.time is actually ISO 8601 format
    if (options.time) {
      if (!Message.isIsoDate(options.time)) { throw new InvalidTimeError(); }
      this.time = options.time;
    }

    // Set the positions
    if (options.position || options.position === 0) { this.position = options.position; }
    if (options.globalPosition || options.globalPosition === 0) {
      this.globalPosition = options.globalPosition;
    }

    // Carry over the rest of the properties
    this.streamName = options.streamName;
    this.type = options.type;
    this.data = options.data;
    this.metadata = options.metadata;
  }

  public static isUuid(u: string): Boolean {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(u);
  }

  public static isIsoDate(t:string) : Boolean {
    const isoTimePattern = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
    return isoTimePattern.test(t);
  }
}
