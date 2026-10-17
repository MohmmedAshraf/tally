<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Group
{
    public function __construct(
        public string $column,
        public ?Granularity $granularity = null,
    ) {}
}
