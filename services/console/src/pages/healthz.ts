import type { APIRoute } from 'astro';

/** Health check without sign-in; independent of the comments service and Umami. */
export const GET: APIRoute = () => Response.json({ ok: true });
