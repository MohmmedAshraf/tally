<?php

declare(strict_types=1);

namespace Tally\Laravel;

use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use stdClass;
use Tally\Laravel\Mutation\Mutation;
use Tally\Laravel\Protocol\Issues;
use Tally\Laravel\Query\Aggregate;
use Tally\Laravel\Query\AggregateFn;
use Tally\Laravel\Query\Direction;
use Tally\Laravel\Query\Pagination;
use Tally\Laravel\Query\QueryRequest;
use Tally\Laravel\Schema\FacetKind;
use Tally\Laravel\Schema\Kind;
use Tally\Laravel\Schema\Schema;
use Tally\Laravel\Sql\Bucket;
use Tally\Laravel\Sql\Compiler;
use Tally\Laravel\Sql\Dialect;
use Tally\Laravel\Sql\Order;
use Tally\Laravel\Sql\Sql;
use Tally\Laravel\Sql\Target;
use Tally\Laravel\Support\Dates;
use Throwable;

final readonly class Adapter
{
    public Schema $schema;

    private Builder $base;

    private Dialect $dialect;

    private Compiler $compiler;

    private string $keyColumn;

    private Sql $keyRef;

    private bool $hiddenKey;

    public function __construct(
        private Grid $grid,
        private ?ExceptionHandler $handler = null,
    ) {
        $query = $grid->query();
        $this->base = $query instanceof EloquentBuilder ? $query->toBase() : $query;
        $this->schema = Schema::make($grid->columns(), $grid->key(), $grid->types());
        $this->dialect = $grid->dialect() ?? Dialect::for($this->base->getConnection());
        $map = $grid->columnMap();
        $grammar = $this->base->getGrammar();
        $this->compiler = Compiler::make(
            $this->schema,
            $this->dialect,
            $grid->today(),
            fn (string $id): string => $grammar->wrap($map[$id] ?? $id),
            $this->flag(...),
        );
        $key = $this->schema->key;
        $this->keyColumn = $map[$key] ?? $key;
        $this->keyRef = $this->compiler->target($key)->ref ?? new Sql($grammar->wrap($this->keyColumn));
        $this->hiddenKey = $this->schema->column($key) === null;
    }

    /**
     * @return array{filter: true, sort: true, group: true, search: true, aggregates: true, facets: true, pagination: string, mutate: bool, live: false}
     */
    public function capabilities(): array
    {
        return [
            'filter' => true,
            'sort' => true,
            'group' => true,
            'search' => true,
            'aggregates' => true,
            'facets' => true,
            'pagination' => $this->grid->pagination()->value,
            'mutate' => $this->grid->mutable(),
            'live' => false,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function describe(): array
    {
        return [
            'version' => 1,
            'columns' => $this->schema->definitions(),
            'capabilities' => $this->capabilities(),
            'key' => $this->schema->key,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function query(QueryRequest $request): array
    {
        $issues = (new Issues($this->schema))->query($request);
        if ($issues !== []) {
            throw TallyException::invalidQuery('Query request is invalid', $issues);
        }
        $where = $request->filter === null ? null : $this->compiler->filter($request->filter);
        $bucket = $request->group === null ? null : $this->compiler->bucket($request->group, $request->sort);
        $rows = $this->ordered($this->select($this->from($where), $this->selection()), [
            ...$bucket->order ?? [],
            ...$this->compiler->order($request->sort),
            new Order($this->keyRef, Direction::Asc),
        ]);
        $slice = $this->slice($request);
        if ($slice === null) {
            $rows->limit($this->grid->maxLimit());
        } else {
            $this->paginate($rows, $slice, $bucket, $where);
        }
        $aggregates = self::uniqueAggregates($request->aggregates);
        $total = $this->from(null)->count();
        $matched = $where === null ? $total : $this->from($where)->count();
        $groups = $bucket === null ? null : $this->groups($bucket, $aggregates, $where);
        $response = [
            'rows' => array_map($this->hydrate(...), self::records($rows)),
            'total' => $total,
            'matched' => $matched,
        ];
        $next = $slice === null ? null : $slice['offset'] + $slice['limit'];
        if ($this->grid->pagination() === Pagination::Cursor && $next !== null && $next < ($groups === null ? $matched : count($groups))) {
            $response['cursor'] = self::encodeCursor($next);
        }
        if ($groups !== null) {
            $response['groups'] = $groups;
        }
        if ($aggregates !== []) {
            $select = Sql::join($this->aggregateParts($aggregates), ', ');
            $response['aggregates'] = $this->readAggregates($aggregates, self::records($this->select($this->from($where), $select))[0] ?? []);
        }
        if ($request->facets !== null) {
            $response['facets'] = $this->facets($request->facets, $where);
        }

        return $response;
    }

    /**
     * @param  list<Mutation>  $mutations
     * @return array{accepted: bool, rows?: list<array<string, mixed>>, errors?: list<array{message: string}>}
     */
    public function mutate(array $mutations): array
    {
        if (! $this->grid->mutable()) {
            return ['accepted' => false, 'errors' => [['message' => 'Source is read only']]];
        }
        $issues = (new Issues($this->schema))->mutations($mutations);
        if ($issues !== []) {
            return ['accepted' => false, 'errors' => array_map(fn (string $message): array => ['message' => $message], $issues)];
        }
        try {
            $this->base->getConnection()->transaction(function () use ($mutations): void {
                foreach ($mutations as $mutation) {
                    $this->apply($mutation);
                }
            });
        } catch (Throwable $exception) {
            $this->handler?->report($exception);

            return ['accepted' => false, 'errors' => [['message' => 'Mutation failed']]];
        }
        $touched = [];
        foreach ($mutations as $mutation) {
            foreach ($mutation->changes as $change) {
                $touched[] = $change->key;
            }
            foreach ($mutation->inserted as $row) {
                $touched[] = $row[$this->schema->key];
            }
        }
        $touched = array_values(array_unique($touched, SORT_REGULAR));
        $rows = $touched === []
            ? []
            : self::records($this->select($this->from(null), $this->selection())->whereIn($this->keyColumn, $touched));

        return ['accepted' => true, 'rows' => array_map($this->hydrate(...), $rows)];
    }

    private function apply(Mutation $mutation): void
    {
        $key = $this->schema->key;
        $deletes = array_map(fn (array $row): mixed => $row[$key], $mutation->deleted);
        if ($deletes !== []) {
            $this->from(null)->whereIn($this->keyColumn, $deletes)->delete();
        }
        foreach ($mutation->inserted as $row) {
            $this->base->newQuery()->from($this->base->from)->insert($this->encodeRow($row));
        }
        $patches = [];
        foreach ($mutation->changes as $change) {
            $column = $this->compiler->require($change->column);
            $patches[(string) $change->key]['key'] = $change->key;
            $patches[(string) $change->key]['values'][$this->sqlColumn($change->column)] = $this->dialect->encode($column->type->kind, $change->to);
        }
        foreach ($patches as $patch) {
            $this->from(null)->where($this->keyColumn, $patch['key'])->update($patch['values']);
        }
    }

    /**
     * @param  array<array-key, mixed>  $row
     * @return array<string, mixed>
     */
    private function encodeRow(array $row): array
    {
        $values = $this->hiddenKey ? [$this->keyColumn => $row[$this->schema->key] ?? null] : [];
        foreach ($this->schema->columns as $id => $column) {
            if (array_key_exists($id, $row)) {
                $values[$this->sqlColumn($id)] = $this->dialect->encode($this->schema->typeOf($column)->kind, $row[$id]);
            }
        }

        return $values;
    }

    private function sqlColumn(string $id): string
    {
        return $this->grid->columnMap()[$id] ?? $id;
    }

    private function from(?Sql $where): Builder
    {
        $query = (clone $this->base)->reorder();

        return $where === null ? $query : $this->where($query, $where);
    }

    private function where(Builder $query, Sql $condition): Builder
    {
        return $query->whereRaw($condition->expression(), $condition->bindings);
    }

    private function select(Builder $query, Sql $columns): Builder
    {
        return $query->select($columns->expression())->addBinding($columns->bindings, 'select');
    }

    private function groupBy(Builder $query, Sql $expression): Builder
    {
        return $query->groupBy($expression->expression())->addBinding($expression->bindings, 'groupBy');
    }

    /**
     * @param  list<Order>  $orders
     */
    private function ordered(Builder $query, array $orders): Builder
    {
        foreach ($orders as $order) {
            $query->orderBy($order->expression->expression(), $order->direction->value)
                ->addBinding($order->expression->bindings, 'order');
        }

        return $query;
    }

    /**
     * @param  array{offset: int, limit: int}  $slice
     */
    private function paginate(Builder $rows, array $slice, ?Bucket $bucket, ?Sql $where): void
    {
        if ($bucket === null) {
            $rows->offset($slice['offset'])->limit($slice['limit']);

            return;
        }
        $page = $this->bucketed($bucket, [], $where)
            ->offset($slice['offset'])
            ->limit(max(0, min($slice['limit'], $this->grid->maxGroups() - $slice['offset'])));
        $this->where($rows, Sql::of(
            '{} in (select {} from ({}) as tally_page)',
            $this->groupMatch($bucket->expression),
            $this->groupMatch(new Sql(Bucket::ALIAS)),
            new Sql($page->toSql(), $page->getBindings()),
        ));
    }

    /**
     * @param  list<Sql>  $columns
     */
    private function bucketed(Bucket $bucket, array $columns, ?Sql $where): Builder
    {
        $select = Sql::join([Sql::of('{} as '.Bucket::ALIAS, $bucket->expression), ...$columns], ', ');
        $grouped = $this->groupBy($this->select($this->from($where), $select), $bucket->expression);

        return $this->ordered($this->base->newQuery()->fromSub($grouped, 'tally_groups'), $bucket->groupOrder);
    }

    private function groupMatch(Sql $bucket): Sql
    {
        return Sql::of("coalesce({}, '')", $this->dialect->text($bucket));
    }

    /**
     * @param  list<Aggregate>  $aggregates
     * @return list<Aggregate>
     */
    private static function uniqueAggregates(array $aggregates): array
    {
        $unique = [];
        foreach ($aggregates as $aggregate) {
            $unique[$aggregate->key()] = $aggregate;
        }

        return array_values($unique);
    }

    /**
     * @return list<array<array-key, mixed>>
     */
    private static function records(Builder $query): array
    {
        return array_values(array_map(fn (mixed $record): array => (array) $record, $query->get()->all()));
    }

    private function selection(): Sql
    {
        $grammar = $this->base->getGrammar();
        $columns = array_map(
            fn (Target $target): string => "{$target->ref->sql} as {$grammar->wrap($target->column->id)}",
            array_values(array_filter(array_map($this->compiler->target(...), array_keys($this->schema->columns)))),
        );
        if ($this->hiddenKey) {
            $columns[] = "{$this->keyRef->sql} as {$grammar->wrap($this->schema->key)}";
        }

        return new Sql(implode(', ', $columns));
    }

    /**
     * @param  array<array-key, mixed>  $row
     * @return array<string, mixed>
     */
    private function hydrate(array $row): array
    {
        $out = $this->hiddenKey ? [$this->schema->key => $row[$this->schema->key] ?? null] : [];
        foreach ($this->schema->columns as $id => $column) {
            $out[$id] = $this->dialect->decode($this->schema->typeOf($column)->kind, $row[$id] ?? null);
        }

        return $out;
    }

    /**
     * @return array{offset: int, limit: int}|null
     */
    private function slice(QueryRequest $request): ?array
    {
        if ($request->page === null) {
            return null;
        }
        $limit = min($this->grid->maxLimit(), $request->page->limit);

        return ['offset' => $request->page->offset ?? self::decodeCursor($request->page->cursor), 'limit' => $limit];
    }

    /**
     * @param  list<Aggregate>  $aggregates
     * @return list<array<string, mixed>>
     */
    private function groups(Bucket $bucket, array $aggregates, ?Sql $where): array
    {
        $query = $this->bucketed($bucket, [new Sql('count(*) as n'), ...$this->aggregateParts($aggregates)], $where)
            ->limit($this->grid->maxGroups());
        $kind = $bucket->target->type->kind;

        return array_map(function (array $row) use ($aggregates, $kind): array {
            $value = $kind === Kind::Date ? ($row[Bucket::ALIAS] ?? null) : $this->dialect->decode($kind, $row[Bucket::ALIAS] ?? null);

            return [
                'key' => self::groupKey($value),
                'value' => $value,
                'count' => self::count($row['n'] ?? 0),
                'aggregates' => $this->readAggregates($aggregates, $row),
            ];
        }, self::records($query));
    }

    /**
     * @param  list<Aggregate>  $aggregates
     * @return list<Sql>
     */
    private function aggregateParts(array $aggregates): array
    {
        return array_map(function (Aggregate $aggregate, int $index): Sql {
            $present = $this->compiler->present($this->compiler->require($aggregate->column));
            $template = match ($aggregate->fn) {
                AggregateFn::Count => 'count({})',
                AggregateFn::Distinct => 'count(distinct {})',
                AggregateFn::Sum => 'coalesce(sum({}), 0)',
                AggregateFn::Avg => 'avg({})',
                AggregateFn::Min => 'min({})',
                AggregateFn::Max => 'max({})',
            };

            return Sql::of("{$template} as a{$index}", $present);
        }, $aggregates, array_keys($aggregates));
    }

    /**
     * @param  list<Aggregate>  $aggregates
     * @param  array<array-key, mixed>  $row
     */
    private function readAggregates(array $aggregates, array $row): stdClass
    {
        $out = new stdClass;
        foreach ($aggregates as $index => $aggregate) {
            $kind = $aggregate->fn->counts() ? Kind::Number : $this->compiler->require($aggregate->column)->type->kind;
            $value = $this->dialect->decode($kind, $row["a{$index}"] ?? null);
            if ($value !== null) {
                $out->{$aggregate->key()} = $value;
            }
        }

        return $out;
    }

    /**
     * @param  list<string>  $ids
     */
    private function facets(array $ids, ?Sql $where): stdClass
    {
        $out = new stdClass;
        foreach (array_unique($ids) as $id) {
            $target = $this->compiler->target($id);
            $kind = $target?->type->kind;
            if ($target?->type->facet === FacetKind::Histogram && ($kind === Kind::Number || $kind === Kind::Date)) {
                $out->{$id} = $this->histogram($target, $where);
            } elseif ($target?->type->facet === FacetKind::Terms) {
                $out->{$id} = $this->terms($target, $where);
            }
        }

        return $out;
    }

    /**
     * @return array{kind: 'terms', terms: list<array{value: mixed, count: int}>, distinct: int}
     */
    private function terms(Target $target, ?Sql $where): array
    {
        $query = $this->groupBy($this->select(
            $this->where($this->from($where), Sql::of('(not {})', $this->compiler->isEmpty($target))),
            Sql::of('{} as v, count(*) as n', $target->ref),
        ), $target->ref);
        $this->ordered($query, $target->type->kind === Kind::Enum && $target->column->options !== []
            ? [new Order($this->compiler->rank($target), Direction::Asc)]
            : [new Order(new Sql('count(*)'), Direction::Desc), new Order($target->ref, Direction::Asc)]);
        $distinct = self::records($this->select($this->from($where), Sql::of('count(distinct {}) as n', $this->compiler->present($target))));

        return [
            'kind' => 'terms',
            'terms' => array_map(fn (array $row): array => [
                'value' => $this->dialect->decode($target->type->kind, $row['v'] ?? null),
                'count' => self::count($row['n'] ?? 0),
            ], self::records($query->limit($this->grid->maxTerms()))),
            'distinct' => self::count($distinct[0]['n'] ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function histogram(Target $target, ?Sql $where): array
    {
        $isDate = $target->type->kind === Kind::Date;
        $numeric = $isDate ? $this->dialect->dayNumber($target->ref) : $target->ref;
        $extent = self::records($this->select($this->from($where), Sql::of('min({}) as lo, max({}) as hi', $numeric, $numeric)))[0] ?? [];
        $lo = $extent['lo'] ?? null;
        $hi = $extent['hi'] ?? null;
        if (! is_numeric($lo) || ! is_numeric($hi)) {
            return ['kind' => 'histogram', 'bins' => []];
        }
        $bins = $this->grid->bins();
        $min = (float) $lo;
        $max = (float) $hi;
        $step = ($max === $min ? 1 : $max - $min) / $bins;
        $index = $this->dialect->floor(Sql::of('({} - {}) / {}', $this->dialect->float($numeric), Sql::value($min), Sql::value($step)));
        $records = self::records($this->groupBy(
            $this->select($this->where($this->from($where), Sql::of('{} is not null', $numeric)), Sql::of('{} as i, count(*) as n', $index)),
            new Sql('i'),
        ));
        $counts = array_fill(0, $bins, 0);
        foreach ($records as $row) {
            $slot = min($bins - 1, self::count($row['i'] ?? 0));
            $counts[$slot] += self::count($row['n'] ?? 0);
        }
        $point = fn (float $value): float|string => $isDate ? Dates::fromDayNumber((int) floor($value + 0.5)) : $value;

        return [
            'kind' => 'histogram',
            'min' => $point($min),
            'max' => $point($max),
            'bins' => array_map(fn (int $count, int $slot): array => [
                'start' => $point($min + $slot * $step),
                'end' => $point($min + ($slot + 1) * $step),
                'count' => $count,
            ], $counts, array_keys($counts)),
        ];
    }

    private function flag(string $name): ?Sql
    {
        $define = $this->grid->flags()[$name] ?? null;
        if ($define === null) {
            return null;
        }
        $query = $this->base->newQuery();
        $define($query);
        $sql = (string) preg_replace('/^where /i', '', $this->base->getGrammar()->compileWheres($query));

        return $sql === '' ? Sql::true() : new Sql("({$sql})", $query->getBindings());
    }

    private static function count(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }

    private static function groupKey(mixed $value): string
    {
        return match (true) {
            $value === null => '',
            is_string($value) => $value,
            is_float($value) && floor($value) === $value => (string) (int) $value,
            default => (string) json_encode($value),
        };
    }

    private static function encodeCursor(int $offset): string
    {
        return rtrim(strtr(base64_encode((string) json_encode(['offset' => $offset])), '+/', '-_'), '=');
    }

    private static function decodeCursor(?string $cursor): int
    {
        if ($cursor === null) {
            return 0;
        }
        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        $parsed = $decoded === false ? null : json_decode($decoded, true);
        $offset = is_array($parsed) ? ($parsed['offset'] ?? null) : null;

        return is_int($offset) && $offset >= 0 ? $offset : 0;
    }
}
