export function extractDominantColors(imgUrl) {
  return new Promise((resolve) => {
    if (!imgUrl) { resolve([]); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 40
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)
        const data = ctx.getImageData(0, 0, size, size).data
        const counts = {}
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
          if (a < 200) continue
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          if (max > 235 && min > 220) continue // near-white
          if (max < 25) continue // near-black
          if (max - min < 12) continue // low-saturation grey
          const key = `${Math.round(r / 24) * 24},${Math.round(g / 24) * 24},${Math.round(b / 24) * 24}`
          counts[key] = (counts[key] || 0) + 1
        }
        resolve(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => {
          const [r, g, b] = key.split(',').map(Number)
          return '#' + [r,g,b].map(v => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('')
        }))
      } catch (e) { resolve([]) }
    }
    img.onerror = () => resolve([])
    img.src = imgUrl
  })
}

