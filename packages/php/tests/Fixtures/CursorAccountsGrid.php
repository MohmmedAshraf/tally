<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests\Fixtures;

use Tally\Laravel\Query\Pagination;

final class CursorAccountsGrid extends AccountsGrid
{
    public function pagination(): Pagination
    {
        return Pagination::Cursor;
    }
}
