import { AxiosRequestConfig } from 'axios';
import { post, PostOptions } from './poster';

describe('HTTP', () => {
  describe('Poster', () => {
    it('Passes the correction options', async () => {
      expect.assertions(3);

      const url = 'https://cars.com/';
      const data = { isTest: true };
      const subOptions : PostOptions = {
        url,
        data,
      };
      const substitute = (options : AxiosRequestConfig) : Promise<any> => {
        expect(options.url).toBe(url);
        expect(options.data).toBe(data);
        expect(options.method).toBe('post');

        return Promise.resolve();
      };

      await post(subOptions, substitute);
    });
  });
});
