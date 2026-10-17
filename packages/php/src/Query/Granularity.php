<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

enum Granularity: string
{
    case Day = 'day';
    case Week = 'week';
    case Month = 'month';
    case Quarter = 'quarter';
    case Year = 'year';
}
