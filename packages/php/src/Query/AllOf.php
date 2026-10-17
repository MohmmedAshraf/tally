<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class AllOf extends Filter
{
    /**
     * @param  list<Filter>  $filters
     */
    public function __construct(public array $filters) {}
}
