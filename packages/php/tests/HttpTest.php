<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tally\Laravel\Protocol\JsonSchema;
use Tally\Laravel\Tests\Fixtures\AccountsGrid;
use Tally\Laravel\Tests\Fixtures\CappedAccountsGrid;
use Tally\Laravel\Tests\Fixtures\CursorAccountsGrid;
use Tally\Laravel\Tests\Fixtures\FlaggedAccountsGrid;
use Tally\Laravel\Tests\Support\Conformance;

beforeEach(function (): void {
    Conformance::seed();
    Route::tally('/api/accounts', AccountsGrid::class);
    Route::tally('/api/flagged/', FlaggedAccountsGrid::class);
});

it('describes the grid with a valid schema response', function (): void {
    $response = $this->getJson('/api/accounts/schema')->assertOk();

    expect($response->json('key'))->toBe('id')
        ->and($response->json('capabilities'))->toBe([
            'filter' => true,
            'sort' => true,
            'group' => true,
            'search' => true,
            'aggregates' => true,
            'facets' => true,
            'pagination' => 'offset',
            'mutate' => true,
            'live' => false,
        ])
        ->and($response->json('columns'))->toBe(Conformance::columns())
        ->and(JsonSchema::issues('schema-response', json_decode((string) $response->getContent())))->toBe([]);
});

it('answers with a valid query response', function (): void {
    $response = $this->postJson('/api/accounts/query', [
        'version' => 1,
        'sort' => [],
        'group' => ['column' => 'plan'],
        'aggregates' => [['column' => 'mrr', 'fn' => 'sum']],
        'facets' => ['plan', 'renewal'],
    ])->assertOk();

    expect(JsonSchema::issues('query-response', json_decode((string) $response->getContent())))->toBe([]);
});

it('rejects requests that break the wire schema', function (): void {
    $this->postJson('/api/accounts/query', ['version' => 2, 'sort' => []])
        ->assertStatus(400)
        ->assertJsonPath('code', 'invalid_query')
        ->assertJsonPath('message', 'Query request is invalid')
        ->assertJsonPath('details.0', fn (string $detail): bool => str_starts_with($detail, 'version: '));
});

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

it('checks condition values against the operator arity', function (mixed $filter, string $detail): void {
    $this->postJson('/api/accounts/query', ['version' => 1, 'sort' => [], 'filter' => $filter])
        ->assertStatus(400)
        ->assertJsonPath('details', [$detail]);
})->with([
    'none' => [['type' => 'condition', 'column' => 'plan', 'op' => 'empty', 'value' => 'x'], 'filter.value: operator "empty" takes no value'],
    'one' => [['type' => 'condition', 'column' => 'mrr', 'op' => 'eq', 'value' => 'x'], 'filter.value: expected a number value for "mrr"'],
    'two' => [['type' => 'condition', 'column' => 'mrr', 'op' => 'between', 'value' => [1]], 'filter.value: expected two number values for "mrr"'],
    'many' => [['type' => 'and', 'filters' => [['type' => 'condition', 'column' => 'seats', 'op' => 'in', 'value' => []]]], 'filter.filters.0.value: expected a list of number values for "seats"'],
    'relative' => [['type' => 'not', 'filter' => ['type' => 'condition', 'column' => 'renewal', 'op' => 'within', 'value' => ['direction' => 'soon', 'amount' => 1, 'unit' => 'day']]], 'filter.filter.value: expected a relative range for "renewal"'],
    'unknown' => [['type' => 'condition', 'column' => 'nope', 'op' => 'eq', 'value' => 1], 'filter.column: unknown column "nope"'],
]);

it('rejects a body that is not JSON', function (): void {
    $this->call('POST', '/api/accounts/query', content: '{nope')
        ->assertStatus(400)
        ->assertJsonPath('message', 'Request body is not valid JSON');
});

it('clamps the page size and compiles flags', function (): void {
    $page = $this->postJson('/api/flagged/query', ['version' => 1, 'sort' => [], 'page' => ['offset' => 0, 'limit' => 100]]);
    $unpaged = $this->postJson('/api/flagged/query', ['version' => 1, 'sort' => []]);
    $paying = $this->postJson('/api/flagged/query', ['version' => 1, 'sort' => [], 'filter' => ['type' => 'flag', 'name' => 'paying']]);
    $everyone = $this->postJson('/api/flagged/query', ['version' => 1, 'sort' => [], 'filter' => ['type' => 'not', 'filter' => ['type' => 'flag', 'name' => 'everyone']]]);
    $unknown = $this->postJson('/api/flagged/query', ['version' => 1, 'sort' => [], 'filter' => ['type' => 'flag', 'name' => 'x']]);

    expect($page->json('rows'))->toHaveCount(3)
        ->and($unpaged->json('rows'))->toHaveCount(3)
        ->and($unpaged->json('matched'))->toBe(count(Conformance::rows()))
        ->and($paying->json('matched'))->toBe(count(array_filter(Conformance::rows(), fn (array $row): bool => ($row['mrr'] ?? 0) > 0)))
        ->and($everyone->json('matched'))->toBe(0)
        ->and($unknown->json('matched'))->toBe(0);
});

it('caps group summaries and the group pages behind them', function (): void {
    Route::tally('/api/capped', CappedAccountsGrid::class);
    $request = ['version' => 1, 'sort' => [], 'group' => ['column' => 'owner']];
    $first = $this->postJson('/api/capped/query', [...$request, 'page' => ['limit' => 2]])->json();
    $beyond = $this->postJson('/api/capped/query', [...$request, 'page' => ['offset' => 2, 'limit' => 2]])->json();
    $owners = array_values(array_unique(array_column($first['rows'], 'owner')));

    expect(array_column($first['groups'], 'key'))->toBe(['Lena', 'Mona'])
        ->and($owners)->toBe(['Lena', 'Mona'])
        ->and($first)->not->toHaveKey('cursor')
        ->and($beyond['rows'])->toBe([]);
});

it('runs each requested facet and aggregate once', function (): void {
    $count = function (array $request): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->postJson('/api/accounts/query', ['version' => 1, 'sort' => [], ...$request])->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };
    $single = $count(['facets' => ['mrr']]);
    $repeated = $count([
        'facets' => array_fill(0, 50, 'mrr'),
        'aggregates' => array_fill(0, 50, ['column' => 'mrr', 'fn' => 'sum']),
    ]);

    expect($repeated)->toBe($single + 1);
});

it('issues opaque cursors that tolerate tampering', function (): void {
    Route::tally('/api/cursor', CursorAccountsGrid::class);
    $first = $this->postJson('/api/cursor/query', ['version' => 1, 'sort' => [], 'page' => ['limit' => 50]])->json();
    $rest = $this->postJson('/api/cursor/query', ['version' => 1, 'sort' => [], 'page' => ['cursor' => $first['cursor'], 'limit' => 50]])->json();
    $bad = $this->postJson('/api/cursor/query', ['version' => 1, 'sort' => [], 'page' => ['cursor' => '!!', 'limit' => 5]])->json();

    expect($first['cursor'])->toBe('eyJvZmZzZXQiOjUwfQ')
        ->and($rest['rows'])->toHaveCount(10)
        ->and($rest)->not->toHaveKey('cursor')
        ->and($bad['rows'])->toHaveCount(5);
});

it('reports live events as not supported', function (): void {
    $this->getJson('/api/accounts/events')
        ->assertNotFound()
        ->assertExactJson(['code' => 'not_found', 'message' => 'Live events are not supported yet', 'details' => []]);
});

it('refuses mutations when read only', function (): void {
    $this->patchJson('/api/flagged/rows', ['version' => 1, 'mutations' => []])
        ->assertStatus(405)
        ->assertExactJson(['code' => 'read_only', 'message' => 'Source is read only', 'details' => []]);
    $this->getJson('/api/flagged/schema')->assertJsonPath('capabilities.mutate', false);
});
