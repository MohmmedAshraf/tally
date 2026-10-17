<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Condition extends Filter
{
    public function __construct(
        public string $column,
        public Operator $op,
        public mixed $value = null,
        public bool $hasValue = false,
    ) {}
}
