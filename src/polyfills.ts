// Browser polyfills for Node.js globals
if (typeof global === 'undefined') {
  (window as any).global = window;
}

if (typeof setImmediate === 'undefined') {
  (window as any).setImmediate = (fn: Function, ...args: any[]) => {
    return setTimeout(fn, 0, ...args);
  };
}

if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (fn: Function, ...args: any[]) => {
      return setTimeout(fn, 0, ...args);
    }
  };
}
