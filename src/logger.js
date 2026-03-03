const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  constructor(level = 'info') {
    this.level = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  }

  _log(level, ...args) {
    if (LOG_LEVELS[level] >= this.level) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      const output = args.map(arg => {
        if (arg instanceof Error) {
          return JSON.stringify({
            message: arg.message,
            stack: arg.stack,
            cause: arg.cause?.message
          }, null, 2);
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      });
      console[level === 'error' ? 'error' : 'log'](prefix, ...output);
    }
  }

  debug(...args) {
    this._log('debug', ...args);
  }

  info(...args) {
    this._log('info', ...args);
  }

  warn(...args) {
    this._log('warn', ...args);
  }

  error(...args) {
    this._log('error', ...args);
  }

  errorWithContext(context, error, extra = {}) {
    this.error(`[${context}]`, error, extra);
  }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');
