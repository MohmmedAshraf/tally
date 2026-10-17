import { inspect } from 'node:util'
import { createApi } from '../server/api.ts'

export default await createApi((error) => {
  process.stderr.write(`${inspect(error)}\n`)
}, 'x-real-ip')
