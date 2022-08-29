import { Pool, ConnectionConfig, QueryResult } from 'pg';
import { Logger, Levels } from '..';

export interface DBOptions {
  connectionString: string
  logLevel?: Levels
}

export class DB {
  private pool!: Pool;
  private logger!: Logger;

  // This is weird, and I know it. Please see the bellow StackOverflow for more info.
  // https://stackoverflow.com/questions/69976411/jest-tlswrap-open-handle-error-using-simple-node-postgres-pool-query-fixed-wit
  static async Make(options: DBOptions) {
    const connectionParams : ConnectionConfig = {
      connectionString: options.connectionString,
      connectionTimeoutMillis: 1000,
    };

    const me = new DB();
    me.logger = options.logLevel
      ? new Logger({ level: options.logLevel })
      : new Logger();

    me.pool = await new Pool(connectionParams);

    return me;
  }

  async query(sql: string, values : any[] = []) {
    this.logger.debug(`DB::query ${sql}, ${values}`);
    const client = await this.pool.connect();
    try {
      const result : QueryResult = await client.query(sql, values);

      return result;
    } finally {
      client.release(true);
    }
  }
}
