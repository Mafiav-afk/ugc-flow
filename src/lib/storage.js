import { useEffect, useState } from 'react'

function read(storage, key, fallback) {
  try { const value = storage.getItem(key); return value ? JSON.parse(value) : fallback } catch { return fallback }
}

export function useStoredState(key, fallback, storage = localStorage) {
  const [value, setValue] = useState(() => read(storage, key, fallback))
  useEffect(() => {
    try { storage.setItem(key, JSON.stringify(value)) } catch { /* storage quota is non-fatal */ }
  }, [key, storage, value])
  return [value, setValue]
}

export function serializableBrief(brief) {
  return { ...brief, assets: (brief.assets || []).map(({ dataUrl: _dataUrl, ...asset }) => asset) }
}
