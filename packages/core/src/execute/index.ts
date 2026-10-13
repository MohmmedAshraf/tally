export {
  aggregateKey,
  aggregateRows,
  aggregateValues,
  type AggregateRequest,
  type AggregateResults,
} from './aggregate.ts'
export {
  createExecutionContext,
  type ExecutionContext,
  type ExecutionOptions,
  type FlagResolver,
} from './context.ts'
export {
  execute,
  type ExecuteRequest,
  type ExecuteResult,
  type ExecutorOptions,
  type Page,
} from './executor.ts'
export {
  computeFacets,
  histogram,
  terms,
  type Facet,
  type FacetOptions,
  type Facets,
  type HistogramBin,
  type HistogramFacet,
  type TermCount,
  type TermsFacet,
} from './facets.ts'
export { groupKeyOf, groupRows, groupValueOf, type RowGroup } from './group.ts'
export { compileFilter, searchPredicate, type Predicate } from './predicate.ts'
export { compileSort, sortRows, type Comparator } from './sort.ts'
export { flattenTree, withAncestors, type TreeNode, type TreeOptions } from './tree.ts'
