<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests\Fixtures;

use Illuminate\Database\Query\Builder;

final class FlaggedAccountsGrid extends AccountsGrid
{
    public function flags(): array
    {
        return [
            'paying' => fn (Builder $query): Builder => $query->where('mrr', '>', 0),
            'everyone' => fn (Builder $query): Builder => $query,
        ];
    }

    public function maxLimit(): int
    {
        return 3;
    }

    public function mutable(): bool
    {
        return false;
    }
}
