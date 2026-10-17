<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests\Fixtures;

use Tally\Laravel\Query\Pagination;

final class CappedAccountsGrid extends AccountsGrid
{
    public function pagination(): Pagination
    {
        return Pagination::Cursor;
    }

    public function maxGroups(): int
    {
        return 2;
    }
}
