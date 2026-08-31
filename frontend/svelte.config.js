import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Собираемся в статику и отдаём тем же Caddy, что и csuam: никакого
    // Node-сервера в контейнере фронтенда нет.
    adapter: adapter({ fallback: 'index.html', strict: false }),
    // Статика лежит в public/, а не в static/: так же, как в csuam, и на этот
    // каталог смотрят Dockerfile и deploy.sh, раскладывая страницы ошибок.
    files: {
      assets: 'public',
    },
    alias: {
      $ui: 'src/lib/ui',
    },
  },
}
