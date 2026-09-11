import 'dotenv/config';
import { registerSecret } from '../utils/redact.js';

function read(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function requireEnv(name) {
  const value = read(name);
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.\n` + '  Copy .env.example to .env and fill it in, or export it in your shell.\n' + "  Key: https://trello.com/power-ups/admin — token: generated from that key's page.");
  }
  registerSecret(value);
  return value;
}

function readInt(name, fallback) {
  const parsed = Number.parseInt(read(name, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  get isCI() {
    return !!process.env.CI;
  },

  trello: {
    get baseUrl() {
      return read('TRELLO_BASE_URL', 'https://api.trello.com');
    },
    get key() {
      return requireEnv('TRELLO_KEY');
    },
    get token() {
      return requireEnv('TRELLO_TOKEN');
    },

    get authHeader() {
      return `OAuth oauth_consumer_key="${this.key}", oauth_token="${this.token}"`;
    },
    get memberId() {
      return read('TRELLO_MEMBER_ID', 'me');
    },
    get isConfigured() {
      return !!read('TRELLO_KEY') && !!read('TRELLO_TOKEN');
    }
  },

  telenor: {
    get baseUrl() {
      return read('TELENOR_BASE_URL', 'https://www.telenor.se');
    },
    get testAddress() {
      return read('TELENOR_TEST_ADDRESS', 'Kungsgatan 103, Uppsala');
    }
  },

  perf: {
    get samples() {
      return readInt('PERF_SAMPLES', 20);
    }
  }
};
