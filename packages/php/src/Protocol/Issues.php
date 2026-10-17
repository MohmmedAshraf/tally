<?php

declare(strict_types=1);

namespace Tally\Laravel\Protocol;

use Tally\Laravel\Mutation\Mutation;
use Tally\Laravel\Query\AllOf;
use Tally\Laravel\Query\AnyOf;
use Tally\Laravel\Query\Arity;
use Tally\Laravel\Query\Condition;
use Tally\Laravel\Query\Filter;
use Tally\Laravel\Query\Not;
use Tally\Laravel\Query\Operator;
use Tally\Laravel\Query\QueryRequest;
use Tally\Laravel\Query\RelativeRange;
use Tally\Laravel\Schema\ColumnType;
use Tally\Laravel\Schema\FacetKind;
use Tally\Laravel\Schema\Kind;
use Tally\Laravel\Schema\Schema;

final readonly class Issues
{
    public function __construct(private Schema $schema) {}

    /**
     * @return list<string>
     */
    public function query(QueryRequest $request): array
    {
        $issues = $request->filter === null ? [] : $this->filter($request->filter, 'filter');
        foreach ($request->sort as $index => $sort) {
            $column = $this->schema->column($sort->column);
            if ($column === null) {
                $issues[] = "sort.{$index}.column: unknown column \"{$sort->column}\"";
            } elseif (! $column->allows('sortable')) {
                $issues[] = "sort.{$index}.column: column \"{$sort->column}\" is not sortable";
            }
        }
        if ($request->group !== null) {
            $id = $request->group->column;
            $column = $this->schema->column($id);
            if ($column === null) {
                $issues[] = "group.column: unknown column \"{$id}\"";
            } else {
                $type = $this->schema->typeOf($column);
                if (! ($column->flag('groupable') ?? $type->groupable)) {
                    $issues[] = "group.column: column \"{$id}\" is not groupable";
                }
                if ($request->group->granularity !== null && $type->kind !== Kind::Date) {
                    $issues[] = 'group.granularity: only date columns accept a granularity';
                }
            }
        }
        foreach ($request->aggregates as $index => $aggregate) {
            $column = $this->schema->column($aggregate->column);
            if ($column === null) {
                $issues[] = "aggregates.{$index}.column: unknown column \"{$aggregate->column}\"";
            } elseif (! in_array($aggregate->fn, $this->schema->typeOf($column)->aggregates, true)) {
                $issues[] = "aggregates.{$index}.fn: aggregate \"{$aggregate->fn->value}\" is not supported by \"{$aggregate->column}\"";
            }
        }
        foreach ($request->facets ?? [] as $index => $id) {
            $column = $this->schema->column($id);
            if ($column === null) {
                $issues[] = "facets.{$index}: unknown column \"{$id}\"";
            } elseif ($this->schema->typeOf($column)->facet === FacetKind::None) {
                $issues[] = "facets.{$index}: column \"{$id}\" has no facet";
            }
        }

        return $issues;
    }

    /**
     * @param  list<Mutation>  $mutations
     * @return list<string>
     */
    public function mutations(array $mutations): array
    {
        $issues = [];
        foreach ($mutations as $index => $mutation) {
            $path = "mutations.{$index}";
            foreach ($mutation->changes as $at => $change) {
                $column = $this->schema->column($change->column);
                if ($column === null) {
                    $issues[] = "{$path}.changes.{$at}.column: unknown column \"{$change->column}\"";
                } elseif ($column->flag('editable') === false) {
                    $issues[] = "{$path}.changes.{$at}.column: column \"{$change->column}\" is not editable";
                } elseif (! self::isEmpty($change->to) && ! $this->schema->typeOf($column)->is($change->to)) {
                    $issues[] = "{$path}.changes.{$at}.to: expected a {$this->schema->typeOf($column)->kind->value} value";
                }
            }
            foreach (['inserted' => $mutation->inserted, 'deleted' => $mutation->deleted] as $kind => $rows) {
                foreach ($rows as $at => $row) {
                    if (! self::isKey($row[$this->schema->key] ?? null)) {
                        $issues[] = "{$path}.{$kind}.{$at}.row: Row key must be a string or a number";
                    }
                }
            }
        }

        return $issues;
    }

    public static function isEmpty(mixed $value): bool
    {
        return $value === null || $value === '';
    }

    public static function isKey(mixed $value): bool
    {
        return is_string($value) || is_int($value) || is_float($value);
    }

    /**
     * @return list<string>
     */
    private function filter(Filter $filter, string $path): array
    {
        return match (true) {
            $filter instanceof Condition => $this->condition($filter, $path),
            $filter instanceof AllOf, $filter instanceof AnyOf => array_merge([], ...array_map(
                fn (Filter $child, int $index): array => $this->filter($child, "{$path}.filters.{$index}"),
                $filter->filters,
                array_keys($filter->filters),
            )),
            $filter instanceof Not => $this->filter($filter->filter, "{$path}.filter"),
            default => [],
        };
    }

    /**
     * @return list<string>
     */
    private function condition(Condition $condition, string $path): array
    {
        $id = $condition->column;
        $column = $this->schema->column($id);
        if ($column === null) {
            return ["{$path}.column: unknown column \"{$id}\""];
        }
        if (! $column->allows('filterable')) {
            return ["{$path}.column: column \"{$id}\" is not filterable"];
        }
        $type = $this->schema->typeOf($column);
        $op = $condition->op;
        if (! in_array($op, $type->operators, true)) {
            return ["{$path}.op: operator \"{$op->value}\" is not supported by type \"{$type->name}\""];
        }
        $value = $condition->value;
        $kind = $type->kind->value;
        $accepts = fn (mixed $entry): bool => self::accepts($type, $op, $entry);

        return match ($op->arity()) {
            Arity::None => $condition->hasValue ? ["{$path}.value: operator \"{$op->value}\" takes no value"] : [],
            Arity::One => $accepts($value) ? [] : ["{$path}.value: expected a {$kind} value for \"{$id}\""],
            Arity::Two => is_array($value) && array_is_list($value) && count($value) === 2 && array_all($value, $accepts)
                ? []
                : ["{$path}.value: expected two {$kind} values for \"{$id}\""],
            Arity::Many => is_array($value) && array_is_list($value) && $value !== [] && array_all($value, $accepts)
                ? []
                : ["{$path}.value: expected a list of {$kind} values for \"{$id}\""],
            Arity::Relative => RelativeRange::from($value) !== null
                ? []
                : ["{$path}.value: expected a relative range for \"{$id}\""],
        };
    }

    private static function accepts(ColumnType $type, Operator $op, mixed $value): bool
    {
        if ($op->matchesText()) {
            return is_string($value);
        }
        if ($type->kind === Kind::Text) {
            return is_string($value) || is_int($value) || is_float($value) || is_bool($value);
        }

        return $type->is($value);
    }
}
