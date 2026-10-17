<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

final readonly class Bucket
{
    /**
     * @param  list<Order>  $order
     */
    public function __construct(
        public Target $target,
        public Sql $expression,
        public array $order,
    ) {}
}
