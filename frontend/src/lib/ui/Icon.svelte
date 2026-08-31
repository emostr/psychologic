<script lang="ts">
  import { ICONS } from './icons'

  interface Props {
    name: string
    size?: number | string
    stroke?: number | string
    class?: string
  }

  let { name, size = 20, stroke = 2, class: klass = '' }: Props = $props()

  const path = $derived(ICONS[name] ?? '')
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke-width={stroke}
  stroke="currentColor"
  stroke-linecap="square"
  stroke-linejoin="miter"
  aria-hidden="true"
  class={klass}>{@html path}</svg
>
