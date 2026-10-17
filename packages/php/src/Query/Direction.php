<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

enum Direction: string
{
    case Asc = 'asc';
    case Desc = 'desc';
}
