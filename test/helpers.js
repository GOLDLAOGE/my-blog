export function fakeKV() {
  const data = new Map();
  return {
    data,
    async get(key, type) {
      const value = data.get(key) ?? null;
      return value && type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { data.set(key, value); },
    async delete(key) { data.delete(key); },
  };
}

export function authEnv() {
  return { CMS_SESSIONS: fakeKV(), CMS_SESSION_SECRET: 'test-secret-at-least-32-characters-long',
    GITHUB_OAUTH_CLIENT_ID: 'test-client', GITHUB_OAUTH_CLIENT_SECRET: 'test-client-secret' };
}
