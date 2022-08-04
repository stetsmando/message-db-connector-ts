import { InMemoryStore } from './store';

describe('In memory store', () => {
  describe('hasCategory', () => {
    it('should return true', () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'transactions';

      inMemoryStore.store = {
        [category]: {},
      };

      expect(inMemoryStore.hasCategory(category)).toBe(true);
    });
    it('should return false', () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'someCategory';
      expect(inMemoryStore.hasCategory(category)).toBe(false);
    });
  });

  describe('hasEntityStream', () => {
    it('should return true', () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'transactions';
      const stream = `${category}-2f67b5bb-9bad-4218-8455-44ed301bb65f`;

      inMemoryStore.store = {
        [category]: {
          [stream]: [],
        },
      };

      expect(inMemoryStore.hasCategory(category)).toBe(true);
    });
    it('should return false', () => {
      const inMemoryStore = new InMemoryStore();
      const category = 'someCategory';
      expect(inMemoryStore.hasCategory(category)).toBe(false);
    });
  });
});
