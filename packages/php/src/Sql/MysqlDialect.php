<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Tally\Laravel\Query\Granularity;

final class MysqlDialect extends Dialect
{
    public function text(Sql $expression): Sql
    {
        return Sql::of('cast({} as char)', $expression);
    }

    public function float(Sql $expression): Sql
    {
        return Sql::of('cast({} as double)', $expression);
    }

    public function dayNumber(Sql $expression): Sql
    {
        return Sql::of("datediff({}, '1970-01-01')", $expression);
    }

    public function dateBucket(Sql $expression, Granularity $granularity): Sql
    {
        return match ($granularity) {
            Granularity::Day => Sql::of("date_format({}, '%Y-%m-%d')", $expression),
            Granularity::Week => Sql::of("date_format(date_sub({}, interval weekday({}) day), '%Y-%m-%d')", $expression, $expression),
            Granularity::Month => Sql::of("date_format({}, '%Y-%m')", $expression),
            Granularity::Quarter => Sql::of("concat(year({}), '-Q', quarter({}))", $expression, $expression),
            Granularity::Year => Sql::of("date_format({}, '%Y')", $expression),
        };
    }
}
