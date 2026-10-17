<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Not extends Filter
{
    public function __construct(public Filter $filter) {}
}
