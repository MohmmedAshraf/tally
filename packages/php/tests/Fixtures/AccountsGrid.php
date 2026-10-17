<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests\Fixtures;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Tally\Laravel\Grid;
use Tally\Laravel\Tests\Support\Conformance;

class AccountsGrid extends Grid
{
    public function query(): Builder
    {
        return DB::table(Conformance::TABLE);
    }

    public function columns(): array
    {
        return Conformance::columns();
    }

    public function today(): string
    {
        return Conformance::today();
    }
}
