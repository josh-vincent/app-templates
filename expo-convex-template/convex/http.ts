import { httpRouter } from 'convex/server';

import { auth } from './auth';
import { rcWebhook } from './iapHttp';

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: '/rc-webhook',
  method: 'POST',
  handler: rcWebhook,
});

export default http;
