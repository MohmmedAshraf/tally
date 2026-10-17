import { loader } from 'fumadocs-core/source'
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'
import { defineDocs } from 'fumadocs-mdx/macro'
import { z } from 'zod'

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({ install: z.string().optional() }),
  },
  meta: {
    schema: metaSchema,
  },
})

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})
