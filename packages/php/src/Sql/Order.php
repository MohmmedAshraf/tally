<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Tally\Laravel\Query\Direction;

final readonly class Order
{
    public function __construct(
        public Sql $expression,
        public Direction $direction,
    ) {}
}
