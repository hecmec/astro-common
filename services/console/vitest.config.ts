import { getViteConfig } from 'astro/config';

// Astro's Vite config, so tests can render .astro components with the container API.
export default getViteConfig({
  test: { include: ['test/**/*.test.ts'] },
});
