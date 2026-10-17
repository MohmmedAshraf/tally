<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tally\Laravel\Adapter;
use Tally\Laravel\Mutation\Change;
use Tally\Laravel\Mutation\Mutation;
use Tally\Laravel\Tests\Fixtures\AccountsGrid;
use Tally\Laravel\Tests\Fixtures\FlaggedAccountsGrid;
use Tally\Laravel\Tests\Fixtures\PeopleGrid;
use Tally\Laravel\Tests\Support\Conformance;

function mutation(array $changes = [], array $inserted = [], array $deleted = []): array
{
    return ['id' => 'm1', 'label' => 'Edit', 'at' => 0, 'changes' => $changes, 'inserted' => $inserted, 'deleted' => $deleted];
}

beforeEach(function (): void {
    Conformance::seed();
    Route::tally('/api/accounts', AccountsGrid::class);
});

it('applies mutations in a transaction and returns canonical rows', function (): void {
    $response = $this->patchJson('/api/accounts/rows', ['version' => 1, 'mutations' => [mutation(
        changes: [
            ['key' => 'acc_002', 'column' => 'mrr', 'from' => 925, 'to' => 1000],
            ['key' => 'acc_002', 'column' => 'active', 'from' => true, 'to' => false],
        ],
        inserted: [['row' => ['id' => 'acc_999', 'account' => 'new', 'plan' => 'pro', 'mrr' => 5, 'active' => true]]],
        deleted: [['row' => ['id' => 'acc_003'], 'index' => 2]],
    )]])->assertOk();

    $rows = array_column($response->json('rows'), null, 'id');
    expect($response->json('accepted'))->toBeTrue()
        ->and($rows['acc_002'])->toMatchArray(['mrr' => 1000, 'active' => false])
        ->and($rows['acc_999'])->toMatchArray(['account' => 'new', 'plan' => 'pro', 'mrr' => 5, 'active' => true, 'seats' => null]);

    $after = $this->postJson('/api/accounts/query', ['version' => 1, 'sort' => []])->json();
    expect($after['total'])->toBe(60)
        ->and(array_column($after['rows'], 'id'))->not->toContain('acc_003');
});

it('rejects mutations that do not fit the schema', function (): void {
    $this->patchJson('/api/accounts/rows', ['version' => 1, 'mutations' => [mutation(
        changes: [['key' => 'acc_001', 'column' => 'mrr', 'from' => 0, 'to' => 'x']],
        inserted: [['row' => ['account' => 'keyless']]],
    )]])->assertStatus(400)->assertJsonPath('details', [
        'mutations.0.changes.0.to: expected a number value',
        'mutations.0.inserted.0.row: Row key must be a string or a number',
    ]);
});

it('rolls back every mutation when one fails', function (): void {
    $response = $this->patchJson('/api/accounts/rows', ['version' => 1, 'mutations' => [
        mutation(changes: [['key' => 'acc_001', 'column' => 'account', 'from' => 'acme', 'to' => 'changed']]),
        mutation(inserted: [['row' => ['id' => 'acc_002', 'account' => 'dup']]]),
    ]])->assertOk();

    expect($response->json())->toBe(['accepted' => false, 'errors' => [['message' => 'Mutation failed']]])
        ->and(DB::table(Conformance::TABLE)->where('id', 'acc_001')->value('account'))->toBe('acme');
});

it('returns rejections from the adapter itself', function (): void {
    $readOnly = new Adapter(new FlaggedAccountsGrid);
    $adapter = new Adapter(new AccountsGrid);

    expect($readOnly->mutate([]))->toBe(['accepted' => false, 'errors' => [['message' => 'Source is read only']]])
        ->and($adapter->mutate([new Mutation([new Change('acc_001', 'nope', 1)])]))
        ->toBe(['accepted' => false, 'errors' => [['message' => 'mutations.0.changes.0.column: unknown column "nope"']]])
        ->and($adapter->mutate([new Mutation]))->toBe(['accepted' => true, 'rows' => []]);
});

it('maps column ids to SQL columns and keeps a key that is not a column', function (): void {
    Schema::create('people', function ($table): void {
        $table->integer('pk')->primary();
        $table->string('full_name');
        $table->boolean('is_ok');
    });
    DB::table('people')->insert([['pk' => 1, 'full_name' => 'Ann', 'is_ok' => true], ['pk' => 2, 'full_name' => 'Bob', 'is_ok' => false]]);
    Route::tally('/api/people', PeopleGrid::class);

    $this->postJson('/api/people/query', [
        'version' => 1,
        'sort' => [['column' => 'name', 'direction' => 'desc']],
        'filter' => ['type' => 'condition', 'column' => 'ok', 'op' => 'eq', 'value' => false],
    ])->assertExactJson(['rows' => [['id' => 2, 'name' => 'Bob', 'ok' => false]], 'total' => 2, 'matched' => 1]);

    $this->patchJson('/api/people/rows', ['version' => 1, 'mutations' => [mutation(
        changes: [['key' => 1, 'column' => 'name', 'from' => 'Ann', 'to' => 'Anna']],
        inserted: [['row' => ['id' => 3, 'name' => 'Cy', 'ok' => true]]],
        deleted: [['row' => ['id' => 2], 'index' => 1]],
    )]])->assertExactJson(['accepted' => true, 'rows' => [
        ['id' => 1, 'name' => 'Anna', 'ok' => true],
        ['id' => 3, 'name' => 'Cy', 'ok' => true],
    ]]);
});
