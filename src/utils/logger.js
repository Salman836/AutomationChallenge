import { redact } from './redact.js';

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const active = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function emit(level, scope, message) {
  if (LEVELS[level] > active) return;
  const write = level === 'error' ? console.error : console.log;
  write(`[${level.toUpperCase()}] ${scope} ${redact(message)}`);
}

export function createLogger(scope) {
  return {
    error: (message) => emit('error', scope, message),
    warn: (message) => emit('warn', scope, message),
    info: (message) => emit('info', scope, message),
    debug: (message) => emit('debug', scope, message)
  };
}
