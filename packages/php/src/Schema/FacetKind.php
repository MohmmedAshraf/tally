<?php

declare(strict_types=1);

namespace Tally\Laravel\Schema;

enum FacetKind: string
{
    case Histogram = 'histogram';
    case Terms = 'terms';
    case None = 'none';
}
