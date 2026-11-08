// Saves text or a file (e.g. a picture) to the device. On a phone this opens the download / Share sheet.
export function downloadFile(filename: string, content: string | Blob, mimeType?: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type: mimeType }) : content)
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
