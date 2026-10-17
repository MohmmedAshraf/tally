<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

enum AggregateFn: string
{
    case Sum = 'sum';
    case Avg = 'avg';
    case Min = 'min';
    case Max = 'max';
    case Count = 'count';
    case Distinct = 'distinct';

    public function counts(): bool
    {
        return $this === self::Count || $this === self::Distinct;
    }
}
