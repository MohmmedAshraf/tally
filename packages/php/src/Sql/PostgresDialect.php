<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Tally\Laravel\Query\Granularity;
use Tally\Laravel\Schema\Kind;

final class PostgresDialect extends Dialect
{
    public function text(Sql $expression): Sql
    {
        return Sql::of('cast({} as text)', $expression);
    }

    public function float(Sql $expression): Sql
    {
        return Sql::of('cast({} as double precision)', $expression);
    }

    public function dayNumber(Sql $expression): Sql
    {
        return Sql::of("(cast({} as date) - date '1970-01-01')", $expression);
    }

    public function dateBucket(Sql $expression, Granularity $granularity): Sql
    {
        $date = Sql::of('cast({} as date)', $expression);

        return match ($granularity) {
            Granularity::Day => Sql::of("to_char({}, 'YYYY-MM-DD')", $date),
            Granularity::Week => Sql::of("to_char(date_trunc('week', {}), 'YYYY-MM-DD')", $date),
            Granularity::Month => Sql::of("to_char({}, 'YYYY-MM')", $date),
            Granularity::Quarter => Sql::of("to_char({}, 'YYYY-\"Q\"Q')", $date),
            Granularity::Year => Sql::of("to_char({}, 'YYYY')", $date),
        };
    }

    public function encode(Kind $kind, mixed $value): mixed
    {
        return $value;
    }
}
