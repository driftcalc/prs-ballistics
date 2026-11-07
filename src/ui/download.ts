// Saves text as a file. On a phone this opens the download / Share sheet.
export function downloadFile(filename: string, text: string, mimeType: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: mimeType }))
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
