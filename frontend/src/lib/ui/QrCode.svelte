<script lang="ts">
  import QRCode from 'qrcode'

  interface Props {
    value: string
    size?: number
    /** Уровень коррекции: M хватает для печати на обычной бумаге. */
    level?: 'L' | 'M' | 'Q' | 'H'
    class?: string
  }

  let { value, size = 96, level = 'M', class: klass = '' }: Props = $props()

  let markup = $state('')

  $effect(() => {
    let cancelled = false
    // SVG, а не canvas: на печати он остаётся чётким при любом DPI принтера.
    QRCode.toString(value, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: level,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((svg) => {
        if (!cancelled) {
          markup = svg.replace('<svg', '<svg width="100%" height="100%"')
        }
      })
      .catch(() => {
        markup = ''
      })
    return () => {
      cancelled = true
    }
  })
</script>

<div class="bg-white {klass}" style="width: {size}px; height: {size}px">
  {@html markup}
</div>
