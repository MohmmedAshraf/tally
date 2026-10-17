<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

enum Arity
{
    case None;
    case One;
    case Two;
    case Many;
    case Relative;
}
