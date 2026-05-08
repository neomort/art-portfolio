// Custom Percy reporter for Playwright
const { percy } = require('@percy/playwright');

class PercyReporter {
  constructor(options) {
    // Initialize the Percy reporter with options
    this.reporter = new percy(options);
  }

  // Forward all reporter methods to the Percy reporter
  onBegin(config, suite) {
    return this.reporter.onBegin?.(config, suite);
  }

  onTestBegin(test) {
    return this.reporter.onTestBegin?.(test);
  }

  onTestEnd(test, result) {
    return this.reporter.onTestEnd?.(test, result);
  }

  onStdOut(chunk, test, result) {
    return this.reporter.onStdOut?.(chunk, test, result);
  }

  onStdErr(chunk, test, result) {
    return this.reporter.onStdErr?.(chunk, test, result);
  }

  onError(error) {
    return this.reporter.onError?.(error);
  }

  onEnd(result) {
    return this.reporter.onEnd?.(result);
  }

  onExit() {
    return this.reporter.onExit?.();
  }
}

module.exports = PercyReporter;
