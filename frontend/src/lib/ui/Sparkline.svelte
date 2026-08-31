<script lang="ts">
  interface Props {
    points?: number[]
    width?: number
    height?: number
    area?: boolean
    class?: string
  }

  let { points = [], width = 120, height = 36, area = true, class: klass = '' }: Props = $props()

  const geo = $derived.by(() => {
    if (points.length < 2) {
      return { line: '', fill: '' }
    }
    const min = Math.min(...points)
    const max = Math.max(...points)
    const span = max - min || 1
    const step = width / (points.length - 1)
    const coords = points.map((value, index) => {
      const x = index * step
      const y = height - ((value - min) / span) * (height - 4) - 2
      return [x, y] as const
    })
    const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    return { line, fill: `${line} L${width},${height} L0,${height} Z` }
  })
</script>

<svg
  viewBox="0 0 {width} {height}"
  {width}
  {height}
  preserveAspectRatio="none"
  class="overflow-visible {klass}"
>
  {#if area && geo.fill}
    <path d={geo.fill} fill="var(--ng-accent)" opacity="0.14" />
  {/if}
  {#if geo.line}
    <path
      d={geo.line}
      fill="none"
      stroke="var(--ng-accent)"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
    />
  {/if}
</svg>
