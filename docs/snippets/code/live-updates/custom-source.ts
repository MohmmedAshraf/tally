import type { DataSource } from 'tally-core'
import { rowPatchSchema } from 'tally-protocol'

export function withSocket(source: DataSource, url: string): DataSource {
  return {
    capabilities: { ...source.capabilities, live: true },
    query: (request, signal) => source.query(request, signal),
    subscribe: (onPatch) => {
      const socket = new WebSocket(url)
      socket.addEventListener('message', (event: MessageEvent<string>) => {
        const parsed = rowPatchSchema.safeParse(JSON.parse(event.data))
        if (parsed.success) onPatch(parsed.data)
      })
      return () => socket.close()
    },
  }
}
