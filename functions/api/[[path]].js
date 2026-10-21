// Cloudflare Pages entry point for the shared save API.
import worker from '../../worker.js';

export const onRequest = ({request, env}) => worker.fetch(request, env);
