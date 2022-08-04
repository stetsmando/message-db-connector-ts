import { AxiosRequestConfig } from 'axios';
import { get, GetOptions } from './getter';

describe('HTTP', () => {
  it('Getter', async () => {
    expect.assertions(2);

    const url = 'https://cars.com';
    const subOptions: GetOptions = { url };
    const substitute = (options: AxiosRequestConfig): Promise<any> => {
      expect(options.url).toBe(url);
      expect(options.method).toBe('get');

      return Promise.resolve();
    };

    await get(subOptions, substitute);
  });
});
