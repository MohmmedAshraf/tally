<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Aggregate
{
    public function __construct(
        public string $column,
        public AggregateFn $fn,
    ) {}

    public function key(): string
    {
        return "{$this->column}:{$this->fn->value}";
    }
}
