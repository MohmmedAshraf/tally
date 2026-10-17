<?php

declare(strict_types=1);

namespace Tally\Laravel\Schema;

use Tally\Laravel\Query\AggregateFn;
use Tally\Laravel\Query\Operator;
use Tally\Laravel\Support\Dates;

final readonly class ColumnType
{
    /**
     * @param  list<Operator>  $operators
     * @param  list<AggregateFn>  $aggregates
     */
    public function __construct(
        public string $name,
        public Kind $kind,
        public array $operators,
        public array $aggregates,
        public FacetKind $facet = FacetKind::None,
        public bool $searchable = false,
        public bool $groupable = false,
    ) {}

    public function is(mixed $value): bool
    {
        return match ($this->kind) {
            Kind::Text, Kind::Enum => is_string($value),
            Kind::Number => is_int($value) || (is_float($value) && is_finite($value)),
            Kind::Boolean => is_bool($value),
            Kind::Date => is_string($value) && Dates::isIso($value),
        };
    }

    public static function text(string $name, bool $groupable = false): self
    {
        return new self(
            $name,
            Kind::Text,
            [Operator::Eq, Operator::Neq, Operator::Contains, Operator::NotContains, Operator::StartsWith, Operator::EndsWith, Operator::In, Operator::NotIn, Operator::Empty, Operator::NotEmpty],
            [AggregateFn::Count, AggregateFn::Distinct],
            $groupable ? FacetKind::Terms : FacetKind::None,
            searchable: true,
            groupable: $groupable,
        );
    }

    /**
     * @param  list<AggregateFn>|null  $aggregates
     */
    public static function number(string $name, ?array $aggregates = null): self
    {
        return new self(
            $name,
            Kind::Number,
            [Operator::Eq, Operator::Neq, Operator::Lt, Operator::Lte, Operator::Gt, Operator::Gte, Operator::Between, Operator::In, Operator::NotIn, Operator::Empty, Operator::NotEmpty],
            $aggregates ?? AggregateFn::cases(),
            FacetKind::Histogram,
        );
    }

    public static function date(string $name = 'date'): self
    {
        return new self(
            $name,
            Kind::Date,
            [Operator::Eq, Operator::Neq, Operator::Lt, Operator::Lte, Operator::Gt, Operator::Gte, Operator::Between, Operator::Within, Operator::Empty, Operator::NotEmpty],
            [AggregateFn::Min, AggregateFn::Max, AggregateFn::Count, AggregateFn::Distinct],
            FacetKind::Histogram,
            groupable: true,
        );
    }

    public static function enum(string $name = 'enum'): self
    {
        return new self(
            $name,
            Kind::Enum,
            [Operator::Eq, Operator::Neq, Operator::In, Operator::NotIn, Operator::Empty, Operator::NotEmpty],
            [AggregateFn::Count, AggregateFn::Distinct],
            FacetKind::Terms,
            searchable: true,
            groupable: true,
        );
    }

    public static function boolean(string $name = 'bool'): self
    {
        return new self(
            $name,
            Kind::Boolean,
            [Operator::Eq, Operator::Neq, Operator::Empty, Operator::NotEmpty],
            [AggregateFn::Count, AggregateFn::Distinct],
            FacetKind::Terms,
            groupable: true,
        );
    }

    /**
     * @return array<string, self>
     */
    public static function builtin(): array
    {
        $types = [
            self::text('text'),
            self::enum(),
            self::number('currency'),
            self::number('int'),
            self::number('number'),
            self::number('percent'),
            self::number('bar', [AggregateFn::Avg, AggregateFn::Min, AggregateFn::Max, AggregateFn::Count]),
            self::date(),
            self::boolean(),
            self::text('email'),
            self::text('url'),
            self::text('id'),
            self::text('person', groupable: true),
            self::number('duration'),
        ];

        return array_combine(array_map(fn (self $type): string => $type->name, $types), $types);
    }
}
