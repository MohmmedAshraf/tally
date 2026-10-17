<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

final readonly class Bucket
{
    public const string ALIAS = 'g';

    /**
     * @param  list<Order>  $order
     * @param  list<Order>  $groupOrder
     */
    public function __construct(
        public Target $target,
        public Sql $expression,
        public array $order,
        public array $groupOrder,
    ) {}
}
