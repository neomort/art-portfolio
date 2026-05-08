// Custom transformer to handle import.meta in Jest
export default {
  process() {
    return {
      code: 'module.exports = { env: { DEV: process.env.NODE_ENV !== "production" } };',
    };
  },
};
