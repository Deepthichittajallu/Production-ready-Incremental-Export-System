const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level) {
  return LOG_LEVELS[level] <= LOG_LEVELS[LOG_LEVEL];
}

function formatLog(level, message, meta = {}) {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(logObject);
}

const logger = {
  info: (message, meta) => {
    if (shouldLog('info')) {
      console.log(formatLog('info', message, meta));
    }
  },
  error: (message, meta) => {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, meta));
    }
  },
  warn: (message, meta) => {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, meta));
    }
  },
  debug: (message, meta) => {
    if (shouldLog('debug')) {
      console.debug(formatLog('debug', message, meta));
    }
  },
};

module.exports = logger;
