<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Closure;
use InvalidArgumentException;
use Tally\Laravel\Query\AllOf;
use Tally\Laravel\Query\AnyOf;
use Tally\Laravel\Query\Condition;
use Tally\Laravel\Query\Direction;
use Tally\Laravel\Query\Filter;
use Tally\Laravel\Query\Flag;
use Tally\Laravel\Query\Granularity;
use Tally\Laravel\Query\Group;
use Tally\Laravel\Query\Not;
use Tally\Laravel\Query\Operator;
use Tally\Laravel\Query\RelativeRange;
use Tally\Laravel\Query\Search;
use Tally\Laravel\Query\Sort;
use Tally\Laravel\Schema\Kind;
use Tally\Laravel\Schema\Schema;

final readonly class Compiler
{
    private const string ESCAPE = "escape '!'";

    /**
     * @param  array<string, Target>  $targets
     * @param  Closure(string): ?Sql  $flag
     */
    private function __construct(
        private array $targets,
        private Dialect $dialect,
        private string $today,
        private Closure $flag,
    ) {}

    /**
     * @param  Closure(string): string  $ref
     * @param  Closure(string): ?Sql  $flag
     */
    public static function make(Schema $schema, Dialect $dialect, string $today, Closure $ref, Closure $flag): self
    {
        $targets = [];
        foreach ($schema->columns as $id => $column) {
            $targets[$id] = new Target($column, $schema->typeOf($column), new Sql($ref($id)));
        }

        return new self($targets, $dialect, $today, $flag);
    }

    public function target(string $id): ?Target
    {
        return $this->targets[$id] ?? null;
    }

    public function require(string $id): Target
    {
        return $this->targets[$id] ?? throw new InvalidArgumentException("Unknown column \"{$id}\"");
    }

    public function isEmpty(Target $target): Sql
    {
        return $target->type->kind->isString()
            ? Sql::of("({} is null or {} = '')", $target->ref, $target->ref)
            : Sql::of('{} is null', $target->ref);
    }

    public function present(Target $target): Sql
    {
        return $target->type->kind->isString()
            ? Sql::of("case when {} <> '' then {} end", $target->ref, $target->ref)
            : $target->ref;
    }

    public function filter(Filter $filter): Sql
    {
        return match (true) {
            $filter instanceof Condition => $this->condition($filter),
            $filter instanceof AllOf => $this->all(array_map($this->filter(...), $filter->filters)),
            $filter instanceof AnyOf => $this->any(array_map($this->filter(...), $filter->filters)),
            $filter instanceof Not => $this->not($this->filter($filter->filter)),
            $filter instanceof Search => $this->search($filter->text),
            $filter instanceof Flag => ($this->flag)($filter->name) ?? Sql::false(),
            default => Sql::false(),
        };
    }

    public function rank(Target $target): Sql
    {
        $options = $target->column->options;
        if ($target->type->kind === Kind::Enum && $options !== []) {
            $branches = Sql::join(
                array_map(fn (string $value, int $index): Sql => new Sql("when ? then {$index}", [$value]), $options, array_keys($options)),
                ' ',
            );

            return Sql::of('case {} {} else '.count($options).' end', $target->ref, $branches);
        }

        return $target->type->kind === Kind::Text ? $this->dialect->lower($target->ref) : $target->ref;
    }

    /**
     * @param  list<Sort>  $sorts
     * @return list<Order>
     */
    public function order(array $sorts): array
    {
        $parts = [];
        foreach ($sorts as $sort) {
            $target = $this->target($sort->column);
            if ($target === null) {
                continue;
            }
            $value = $target->with($this->present($target));
            $parts[] = new Order($this->isEmpty($target), Direction::Asc);
            $parts[] = new Order($this->rank($value), $sort->direction);
            if ($target->type->kind === Kind::Enum) {
                $parts[] = new Order($value->ref, $sort->direction);
            }
        }

        return $parts;
    }

    /**
     * @param  list<Sort>  $sorts
     */
    public function bucket(Group $group, array $sorts): Bucket
    {
        $target = $this->require($group->column);
        $isDate = $target->type->kind === Kind::Date;
        $expression = $isDate
            ? $this->dialect->dateBucket($target->ref, $group->granularity ?? Granularity::Month)
            : $this->present($target);
        $direction = $isDate ? Direction::Desc : Direction::Asc;
        foreach ($sorts as $sort) {
            if ($sort->column === $target->column->id) {
                $direction = $sort->direction;
                break;
            }
        }
        $bucketed = $target->with($expression);

        return new Bucket($target, $expression, [
            new Order($this->isEmpty($bucketed), Direction::Asc),
            new Order($this->rank($bucketed), $direction),
        ]);
    }

    private function condition(Condition $node): Sql
    {
        $target = $this->target($node->column);
        if ($target === null) {
            return Sql::false();
        }
        $value = $node->value;

        return match ($node->op) {
            Operator::Eq => $this->equals($target, $value),
            Operator::Neq => $this->orEmpty($target, $this->equals($target, $value)),
            Operator::Lt => Sql::of('{} < {}', $target->ref, $this->encoded($target, $value)),
            Operator::Lte => Sql::of('{} <= {}', $target->ref, $this->encoded($target, $value)),
            Operator::Gt => Sql::of('{} > {}', $target->ref, $this->encoded($target, $value)),
            Operator::Gte => Sql::of('{} >= {}', $target->ref, $this->encoded($target, $value)),
            Operator::Between => $this->between($target, ...$this->pair($value)),
            Operator::Within => $this->within($target, $value),
            Operator::Contains => $this->like($target, '%'.$this->escape($value).'%'),
            Operator::NotContains => $this->orEmpty($target, $this->like($target, '%'.$this->escape($value).'%')),
            Operator::StartsWith => $this->like($target, $this->escape($value).'%'),
            Operator::EndsWith => $this->like($target, '%'.$this->escape($value)),
            Operator::In => $this->member($target, is_array($value) ? array_values($value) : [$value]),
            Operator::NotIn => $this->orEmpty($target, $this->member($target, is_array($value) ? array_values($value) : [$value])),
            Operator::Empty => $this->isEmpty($target),
            Operator::NotEmpty => $this->not($this->isEmpty($target)),
        };
    }

    private function search(string $text): Sql
    {
        $needle = mb_strtolower(trim($text));
        if ($needle === '') {
            return Sql::true();
        }
        $pattern = '%'.$this->escape($needle).'%';
        $searchable = array_filter(
            $this->targets,
            fn (Target $target): bool => $target->column->flag('searchable') ?? $target->type->searchable,
        );

        return $this->any(array_values(array_map(
            fn (Target $target): Sql => Sql::of('{} like {} '.self::ESCAPE, $this->dialect->lower($this->dialect->text($target->ref)), Sql::value($pattern)),
            $searchable,
        )));
    }

    private function equals(Target $target, mixed $value): Sql
    {
        return $target->type->kind === Kind::Text
            ? Sql::of('{} = {}', $this->dialect->lower($target->ref), Sql::value(self::lowerText($value)))
            : Sql::of('{} = {}', $target->ref, $this->encoded($target, $value));
    }

    private function like(Target $target, string $pattern): Sql
    {
        return Sql::of('{} like {} '.self::ESCAPE, $this->dialect->lower($target->ref), Sql::value($pattern));
    }

    /**
     * @param  list<mixed>  $values
     */
    private function member(Target $target, array $values): Sql
    {
        if ($values === []) {
            return Sql::false();
        }
        $text = $target->type->kind === Kind::Text;
        $items = Sql::join(array_map(
            fn (mixed $value): Sql => $text ? Sql::value(self::lowerText($value)) : $this->encoded($target, $value),
            $values,
        ), ', ');

        return Sql::of('{} in ({})', $text ? $this->dialect->lower($target->ref) : $target->ref, $items);
    }

    private function between(Target $target, mixed $low, mixed $high): Sql
    {
        return Sql::of('({} >= {} and {} <= {})', $target->ref, $this->encoded($target, $low), $target->ref, $this->encoded($target, $high));
    }

    private function within(Target $target, mixed $value): Sql
    {
        $range = RelativeRange::from($value);
        if ($range === null) {
            return Sql::false();
        }

        return $this->between($target, ...$range->resolve($this->today));
    }

    private function encoded(Target $target, mixed $value): Sql
    {
        return Sql::value($this->dialect->encode($target->type->kind, $value));
    }

    private function orEmpty(Target $target, Sql $part): Sql
    {
        return $this->any([$this->isEmpty($target), $this->not($part)]);
    }

    /**
     * @param  list<Sql>  $parts
     */
    private function all(array $parts): Sql
    {
        return $parts === [] ? Sql::true() : Sql::of('({})', Sql::join($parts, ' and '));
    }

    /**
     * @param  list<Sql>  $parts
     */
    private function any(array $parts): Sql
    {
        return $parts === [] ? Sql::false() : Sql::of('({})', Sql::join($parts, ' or '));
    }

    private function not(Sql $part): Sql
    {
        return Sql::of('(not coalesce({}, 1 = 0))', $part);
    }

    /**
     * @return array{mixed, mixed}
     */
    private function pair(mixed $value): array
    {
        return is_array($value) ? [$value[0] ?? null, $value[1] ?? null] : [null, null];
    }

    private function escape(mixed $value): string
    {
        return (string) preg_replace('/[!%_]/', '!$0', self::lowerText($value));
    }

    private static function lowerText(mixed $value): string
    {
        return mb_strtolower(match (true) {
            is_bool($value) => $value ? 'true' : 'false',
            is_scalar($value) => (string) $value,
            default => '',
        });
    }
}
