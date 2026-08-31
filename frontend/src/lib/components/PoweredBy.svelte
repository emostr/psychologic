<script lang="ts">
  // Без логотипов: набор коротких подписей в том же наборном стиле,
  // что и заголовки разделов.
  const STACK = ['TypeScript', 'Svelte', 'NestJS', 'Prisma', 'PostgreSQL', 'Tailwind', 'Docker', 'Caddy']
</script>

<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-faint">
  <span class="uppercase font-bold">powered by</span>
  {#each STACK as item, index (item)}
    <span class="hover:text-accent transition-colors">{item}</span>
    {#if index < STACK.length - 1}<span class="text-line-strong">·</span>{/if}
  {/each}
</div>
