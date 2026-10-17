<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Tally\Laravel\Query\Granularity;

final class SqliteDialect extends Dialect
{
    public function text(Sql $expression): Sql
    {
        return Sql::of('cast({} as text)', $expression);
    }

    public function float(Sql $expression): Sql
    {
        return Sql::of('cast({} as real)', $expression);
    }

    public function floor(Sql $expression): Sql
    {
        return Sql::of(
            '(case when {} < cast({} as integer) then cast({} as integer) - 1 else cast({} as integer) end)',
            $expression,
            $expression,
            $expression,
            $expression,
        );
    }

    public function dayNumber(Sql $expression): Sql
    {
        return Sql::of("cast(julianday({}) - julianday('1970-01-01') as integer)", $expression);
    }

    public function dateBucket(Sql $expression, Granularity $granularity): Sql
    {
        return match ($granularity) {
            Granularity::Day => $expression,
            Granularity::Week => Sql::of("date({}, '-' || ((strftime('%w', {}) + 6) % 7) || ' days')", $expression, $expression),
            Granularity::Month => Sql::of('substr({}, 1, 7)', $expression),
            Granularity::Quarter => Sql::of("strftime('%Y', {}) || '-Q' || ((strftime('%m', {}) - 1) / 3 + 1)", $expression, $expression),
            Granularity::Year => Sql::of("strftime('%Y', {})", $expression),
        };
    }
}
