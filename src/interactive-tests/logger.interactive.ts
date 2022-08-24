import { Logger, Levels } from '../logger';

const LoggerOff = new Logger({ level: Levels.Off });
const LoggerError = new Logger({ level: Levels.Error });
const LoggerInfo = new Logger({ level: Levels.Info });
const LoggerVerbose = new Logger({ level: Levels.Verbose });
const LoggerDebug = new Logger({ level: Levels.Debug });

const loggers = [LoggerOff, LoggerError, LoggerInfo, LoggerVerbose, LoggerDebug];
const message = 'This is a log message';

console.log('Starting from 0, each logger should add one to the number of statements produced.');

loggers.forEach((logger) => {
  console.log(`Testing ${logger.level} logger.`);
  logger.error(message);
  logger.info(message);
  logger.verbose(message);
  logger.debug(message);
  console.log('');
});
