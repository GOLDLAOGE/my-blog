export function requireEnv(env, keys) {
  for (const key of keys) {
    if (env[key] === undefined || env[key] === null || env[key] === '') {
      const error = new Error(`Missing required environment value: ${key}`);
      error.name = 'MissingEnvironmentError';
      throw error;
    }
  }

  return env;
}
