// Prints a chunk of markup on its own, always black on white (Sun theme).
// The page size is set just for this print (3x5 index cards for stage cards,
// normal paper for the range card), then everything is put back.
export function printArea(html: string, pageCss: string): void {
  document.querySelector('.print-area')?.remove()
  document.querySelector('style[data-print-page]')?.remove()
  const area = document.createElement('div')
  area.className = 'print-area'
  area.dataset.theme = 'sun'
  area.innerHTML = html
  const page = document.createElement('style')
  page.dataset.printPage = ''
  page.textContent = `@media print { @page { ${pageCss} } }`
  document.head.append(page)
  document.body.append(area)
  document.body.classList.add('printing')
  window.addEventListener(
    'afterprint',
    () => {
      area.remove()
      page.remove()
      document.body.classList.remove('printing')
    },
    { once: true },
  )
  window.print()
}
