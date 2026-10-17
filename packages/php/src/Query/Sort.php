<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Sort
{
    public function __construct(
        public string $column,
        public Direction $direction,
    ) {}
}
