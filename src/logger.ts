// NOTE: These levels match the npm logging levels, however,
// not all the npm defined levels are used.
export enum Levels {
  'Off' = -1,
  'Error' = 0,
  'Info' = 2,
  'Verbose' = 4,
  'Debug' = 5,
}

const DEFAULT_LEVEL = Levels.Info;
export interface LoggerOptions {
  level: Levels
}
export class Logger {
  readonly level: Levels;

  constructor(options?: LoggerOptions) {
    this.level = options
      ? options.level
      : DEFAULT_LEVEL;
  }

  error(toWrite: string) {
    if (this.level >= Levels.Error) {
      console.error(toWrite);
    }
  }

  info(toWrite: string) {
    if (this.level >= Levels.Info) {
      console.log(toWrite);
    }
  }

  verbose(toWrite: string) {
    if (this.level >= Levels.Verbose) {
      console.log(toWrite);
    }
  }

  debug(toWrite: string) {
    if (this.level >= Levels.Debug) {
      console.log(toWrite);
    }
  }
}
