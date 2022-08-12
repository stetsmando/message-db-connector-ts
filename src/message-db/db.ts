import { Pool, ConnectionConfig, QueryResult } from 'pg';

export interface DBOptions {
  connectionString: string,
}

export class DB {
  private pool!: Pool;

  // This is weird, and I know it. Please see the bellow StackOverflow for more info.
  // https://stackoverflow.com/questions/69976411/jest-tlswrap-open-handle-error-using-simple-node-postgres-pool-query-fixed-wit
  static async Make(options: DBOptions) {
    const connectionParams : ConnectionConfig = {
      connectionString: options.connectionString,
      connectionTimeoutMillis: 1000,
    };

    const me = new DB();
    me.pool = await new Pool(connectionParams);

    return me;
  }

  async query(sql: string, values : any[] = []) {
    const client = await this.pool.connect();
    try {
      const result : QueryResult = await client.query(sql, values);

      return result;
    } catch (error) {
      console.log(error);
      throw error;
    } finally {
      client.release(true);
    }
  }
}
