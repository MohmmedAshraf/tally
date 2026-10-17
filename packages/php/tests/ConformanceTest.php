<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Tally\Laravel\Tests\Fixtures\AccountsGrid;
use Tally\Laravel\Tests\Fixtures\CursorAccountsGrid;
use Tally\Laravel\Tests\Support\Conformance;

beforeEach(function (): void {
    Conformance::seed();
    Route::tally('/api/accounts', AccountsGrid::class);
    Route::tally('/api/cursor', CursorAccountsGrid::class);
});

it('conforms', function (array $case): void {
    $response = $this->postJson('/api/accounts/query', $case['request'])->assertOk()->json();

    expect(Conformance::diff($case['expected'], $response))->toBe([]);
})->with(Conformance::cases());

it('conforms when paged by offset', function (array $case): void {
    $response = $this->postJson('/api/accounts/query', $case['request'])->assertOk()->json();

    expect(Conformance::diff($case['expected'], $response))->toBe([]);
})->with(Conformance::cases('pages'));

it('conforms when walked by cursor', function (array $case): void {
    $rows = [];
    $cursor = null;
    $depth = 0;
    do {
        $page = $cursor === null ? ['limit' => 17] : ['cursor' => $cursor, 'limit' => 17];
        $response = $this->postJson('/api/cursor/query', [...$case['request'], 'page' => $page])->assertOk()->json();
        $rows = [...$rows, ...$response['rows']];
        $cursor = $response['cursor'] ?? null;
    } while ($cursor !== null && $response['rows'] !== [] && ++$depth < 100);

    expect(Conformance::diff($case['expected'], [...$response, 'rows' => $rows]))->toBe([]);
})->with(array_slice(Conformance::cases(), 0, 12));
