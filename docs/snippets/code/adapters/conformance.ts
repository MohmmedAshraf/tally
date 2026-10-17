import { createArraySource } from 'tally-core'
import {
  CONFORMANCE_TODAY,
  conformanceRows,
  conformanceSchema,
  runConformance,
} from 'tally-protocol'

const source = createArraySource(conformanceRows, conformanceSchema, {
  today: CONFORMANCE_TODAY,
  pagination: 'cursor',
})

const report = await runConformance((request) => source.query(request), {
  capabilities: source.capabilities,
})

for (const failure of report.failures) {
  process.stderr.write(`${failure.name}\n  ${failure.diffs.join('\n  ')}\n`)
}
process.exitCode = report.passed ? 0 : 1
