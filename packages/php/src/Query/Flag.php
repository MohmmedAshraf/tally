<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Flag extends Filter
{
    public function __construct(public string $name) {}
}
