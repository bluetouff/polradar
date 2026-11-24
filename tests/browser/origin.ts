const configuredPort = process.env.POLRADAR_TEST_PORT ?? '44321';
if (
  !/^[0-9]{1,5}$/.test(configuredPort) ||
  Number(configuredPort) < 1024 ||
  Number(configuredPort) > 65535
)
  throw Error('Port de recette invalide');
export const testPort = Number(configuredPort);
export const testOrigin = `http://127.0.0.1:${testPort}`;
