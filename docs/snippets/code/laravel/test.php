it('rejects requests that do not fit the schema', function (): void {
    $this->postJson('/api/accounts/query', [
        'version' => 1,
        'sort' => [['column' => 'nope', 'direction' => 'asc']],
        'filter' => ['type' => 'condition', 'column' => 'plan', 'op' => 'contains', 'value' => 'x'],
        'group' => ['column' => 'mrr', 'granularity' => 'day'],
        'aggregates' => [['column' => 'plan', 'fn' => 'sum']],
        'facets' => ['email'],
    ])->assertStatus(400)->assertExactJson([
        'code' => 'invalid_query',
        'message' => 'Query request is invalid',
        'details' => [
            'filter.op: operator "contains" is not supported by type "enum"',
            'sort.0.column: unknown column "nope"',
            'group.column: column "mrr" is not groupable',
            'group.granularity: only date columns accept a granularity',
            'aggregates.0.fn: aggregate "sum" is not supported by "plan"',
            'facets.0: column "email" has no facet',
        ],
    ]);
});
