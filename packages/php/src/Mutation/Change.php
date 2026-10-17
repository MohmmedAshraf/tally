<?php

declare(strict_types=1);

namespace Tally\Laravel\Mutation;

final readonly class Change
{
    public function __construct(
        public string|int|float $key,
        public string $column,
        public mixed $to,
    ) {}
}
