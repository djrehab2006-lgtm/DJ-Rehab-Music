const store = new Map();

module.exports = {
  default: {
    getItem: async (key) => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => void store.set(key, value),
    removeItem: async (key) => void store.delete(key),
  },
};
module.exports.__esModule = true;
