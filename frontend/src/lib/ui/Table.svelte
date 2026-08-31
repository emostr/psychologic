<script lang="ts" generics="T">
  import type { Snippet } from 'svelte'

  interface Column {
    key: string
    label: string
    align?: 'left' | 'right' | 'center'
    width?: string
    hideOnMobile?: boolean
  }

  interface Props {
    columns: Column[]
    rows: T[]
    row: Snippet<[T, number]>
    empty?: string
    hover?: boolean
    class?: string
  }

  let { columns, rows, row, empty = 'Нет данных', hover = true, class: klass = '' }: Props = $props()

  function align(column: Column): string {
    if (column.align === 'right') {
      return 'text-right'
    }
    if (column.align === 'center') {
      return 'text-center'
    }
    return 'text-left'
  }
</script>

<div class="w-full overflow-x-auto border border-line bg-surface {klass}">
  <table class="w-full text-sm border-collapse">
    <thead>
      <tr class="border-b border-line">
        {#each columns as column (column.key)}
          <th
            class="ng-label text-muted px-4 py-3 whitespace-nowrap {align(column)} {column.hideOnMobile
              ? 'hidden md:table-cell'
              : ''}"
            style={column.width ? `width: ${column.width}` : undefined}
          >
            {column.label}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as item, index (index)}
        <tr class="border-b border-line last:border-0 transition-colors {hover ? 'hover:bg-surface-2' : ''}">
          {@render row(item, index)}
        </tr>
      {:else}
        <tr>
          <td colspan={columns.length} class="px-4 py-10 text-center text-muted text-sm">{empty}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
