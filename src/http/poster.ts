import axios from 'axios';

// TODO: When we add auth into the connector, this is where those creds will be stored
export interface PostOptions {
  url: string,
  data: any
}

export function post(
  options : PostOptions,
  substitute? : typeof axios | Function,
) : Promise<any> {
  const toUse = substitute || axios;

  return toUse({
    ...options,
    method: 'post',
  });
}
