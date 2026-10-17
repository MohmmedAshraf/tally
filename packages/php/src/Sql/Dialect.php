<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use DateTimeInterface;
use Illuminate\Database\ConnectionInterface;
use InvalidArgumentException;
use Tally\Laravel\Query\Granularity;
use Tally\Laravel\Schema\Kind;

abstract class Dialect
{
    public static function for(ConnectionInterface $connection): self
    {
        $driver = method_exists($connection, 'getDriverName') ? $connection->getDriverName() : null;

        return match ($driver) {
            'sqlite' => new SqliteDialect,
            'pgsql' => new PostgresDialect,
            'mysql', 'mariadb' => new MysqlDialect,
            default => throw new InvalidArgumentException('No Tally dialect for driver "'.(is_string($driver) ? $driver : 'unknown').'", return one from Grid::dialect()'),
        };
    }

    abstract public function text(Sql $expression): Sql;

    abstract public function float(Sql $expression): Sql;

    abstract public function dayNumber(Sql $expression): Sql;

    abstract public function dateBucket(Sql $expression, Granularity $granularity): Sql;

    public function lower(Sql $expression): Sql
    {
        return Sql::of('lower({})', $expression);
    }

    public function floor(Sql $expression): Sql
    {
        return Sql::of('floor({})', $expression);
    }

    public function encode(Kind $kind, mixed $value): mixed
    {
        return $kind === Kind::Boolean && is_bool($value) ? (int) $value : $value;
    }

    public function decode(Kind $kind, mixed $value): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($kind) {
            Kind::Number => is_string($value) && is_numeric($value) ? $value + 0 : $value,
            Kind::Boolean => is_bool($value) ? $value : (is_numeric($value) && (float) $value !== 0.0),
            Kind::Date => $value instanceof DateTimeInterface ? $value->format('Y-m-d') : $value,
            Kind::Text, Kind::Enum => $value,
        };
    }
}
