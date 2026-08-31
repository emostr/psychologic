<script lang="ts">
  interface Props {
    rows?: number
    class?: string
  }

  let { rows = 3, class: klass = '' }: Props = $props()
</script>

<div class="space-y-3 {klass}">
  {#each Array(rows) as _, i (i)}
    <div class="h-4 bg-surface-2 animate-pulse" style="width: {90 - i * 12}%"></div>
  {/each}
</div>
