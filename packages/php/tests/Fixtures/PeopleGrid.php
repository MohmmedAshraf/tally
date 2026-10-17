<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests\Fixtures;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Tally\Laravel\Grid;

final class PeopleGrid extends Grid
{
    public function query(): Builder
    {
        return DB::table('people');
    }

    public function columns(): array
    {
        return [['id' => 'name'], ['id' => 'ok', 'type' => 'bool']];
    }

    public function columnMap(): array
    {
        return ['id' => 'pk', 'name' => 'full_name', 'ok' => 'is_ok'];
    }
}
