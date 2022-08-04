import axios from 'axios';

// TODO: When we add auth into the connector, this is where those creds will be stored
export interface GetOptions {
  url: string
}

export function get(
  options: GetOptions,
  substitute?: typeof axios | Function,
) {
  const toUse = substitute || axios;

  return toUse({
    ...options,
    method: 'get',
  });
}
