<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

enum Operator: string
{
    case Eq = 'eq';
    case Neq = 'neq';
    case Lt = 'lt';
    case Lte = 'lte';
    case Gt = 'gt';
    case Gte = 'gte';
    case Between = 'between';
    case Contains = 'contains';
    case NotContains = 'notContains';
    case StartsWith = 'startsWith';
    case EndsWith = 'endsWith';
    case In = 'in';
    case NotIn = 'notIn';
    case Empty = 'empty';
    case NotEmpty = 'notEmpty';
    case Within = 'within';

    public function arity(): Arity
    {
        return match ($this) {
            self::Between => Arity::Two,
            self::In, self::NotIn => Arity::Many,
            self::Empty, self::NotEmpty => Arity::None,
            self::Within => Arity::Relative,
            default => Arity::One,
        };
    }

    public function matchesText(): bool
    {
        return in_array($this, [self::Contains, self::NotContains, self::StartsWith, self::EndsWith], true);
    }
}
