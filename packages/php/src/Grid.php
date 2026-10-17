<?php

declare(strict_types=1);

namespace Tally\Laravel;

use Closure;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Date;
use Tally\Laravel\Query\Pagination;
use Tally\Laravel\Schema\ColumnType;
use Tally\Laravel\Sql\Dialect;

abstract class Grid
{
    /**
     * @return EloquentBuilder<covariant Model>|Builder
     */
    abstract public function query(): EloquentBuilder|Builder;

    /**
     * @return list<array<string, mixed>>
     */
    abstract public function columns(): array;

    public function key(): string
    {
        return 'id';
    }

    /**
     * @return array<string, string>
     */
    public function columnMap(): array
    {
        return [];
    }

    /**
     * @return array<string, Closure(Builder): mixed>
     */
    public function flags(): array
    {
        return [];
    }

    /**
     * @return list<ColumnType>
     */
    public function types(): array
    {
        return [];
    }

    public function dialect(): ?Dialect
    {
        return null;
    }

    public function mutable(): bool
    {
        return true;
    }

    public function pagination(): Pagination
    {
        return Pagination::Offset;
    }

    public function maxLimit(): int
    {
        return 1000;
    }

    public function bins(): int
    {
        return 20;
    }

    public function maxTerms(): int
    {
        return 50;
    }

    public function maxGroups(): int
    {
        return 1000;
    }

    public function today(): string
    {
        return Date::today()->toDateString();
    }
}
