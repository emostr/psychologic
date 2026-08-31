/**
 * Переносит элемент в конец <body>.
 *
 * Нужно всему, что позиционируется относительно окна: у предка с
 * backdrop-filter, filter или transform свой containing block, и `fixed`
 * внутри него отсчитывается от предка, а не от вьюпорта. Из-за этого
 * выпадающее меню в шапке с backdrop-blur уезжало и не накрывалось подложкой.
 */
export function portal(node: HTMLElement) {
  const target = document.body
  target.appendChild(node)
  return {
    destroy() {
      node.remove()
    },
  }
}
