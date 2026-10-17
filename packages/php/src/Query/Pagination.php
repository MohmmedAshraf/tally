<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

enum Pagination: string
{
    case Offset = 'offset';
    case Cursor = 'cursor';
}
