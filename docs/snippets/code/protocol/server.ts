import { TallyError, createArraySource, createSchema } from 'tally-core'
import { validateQueryRequest } from 'tally-protocol'

const schema = createSchema({
  key: 'id',
  columns: [{ id: 'account' }, { id: 'mrr', type: 'currency' }],
})
const source = createArraySource([{ id: 1, account: 'Acme', mrr: 4200 }], schema)

export async function query(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json()
    const valid = validateQueryRequest(body, schema)
    return Response.json(await source.query(valid, request.signal))
  } catch (error) {
    if (!(error instanceof TallyError)) throw error
    const { code, message, details } = error
    return Response.json({ code, message, details }, { status: 400 })
  }
}
