<script lang="ts">
  import { Chart, registerables, type ChartConfiguration } from 'chart.js'
  import { theme, cssVar } from '$lib/theme.svelte'

  Chart.register(...registerables)

  interface Props {
    config: () => ChartConfiguration
    height?: number
    class?: string
  }

  let { config, height = 260, class: klass = '' }: Props = $props()

  let canvas = $state<HTMLCanvasElement | null>(null)
  let chart: Chart | null = null

  function build() {
    if (!canvas) {
      return
    }
    chart?.destroy()
    const base = config()
    const muted = cssVar('--ng-muted')
    const line = cssVar('--ng-line')

    // Общие для всех графиков цвета берём из темы, чтобы подписи не терялись
    // на светлом фоне и не слепили на тёмном.
    Chart.defaults.color = muted
    Chart.defaults.borderColor = line
    Chart.defaults.font.family = "'Open Sans', system-ui, sans-serif"

    chart = new Chart(canvas, base)
  }

  $effect(() => {
    // Перечитываем revision — при смене темы или акцента график перерисуется.
    void theme.revision
    void config
    build()
    return () => {
      chart?.destroy()
      chart = null
    }
  })
</script>

<div class={klass} style="height: {height}px">
  <canvas bind:this={canvas}></canvas>
</div>
