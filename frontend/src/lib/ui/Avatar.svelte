<script lang="ts">
  interface Props {
    name?: string
    size?: number
    class?: string
  }

  let { name = '', size = 40, class: klass = '' }: Props = $props()

  const initials = $derived(
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  )
</script>

<span
  class="inline-flex items-center justify-center overflow-hidden bg-accent text-on-accent font-bold shrink-0 {klass}"
  style="width: {size}px; height: {size}px; font-size: {Math.round(size * 0.38)}px"
>
  {initials}
</span>
