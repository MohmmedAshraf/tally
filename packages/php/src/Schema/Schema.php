<?php

declare(strict_types=1);

namespace Tally\Laravel\Schema;

use InvalidArgumentException;

final readonly class Schema
{
    /**
     * @param  array<string, Column>  $columns
     * @param  array<string, ColumnType>  $types
     */
    private function __construct(
        public array $columns,
        public string $key,
        private array $types,
    ) {}

    /**
     * @param  list<array<array-key, mixed>>  $columns
     * @param  list<ColumnType>  $types
     */
    public static function make(array $columns, string $key = 'id', array $types = []): self
    {
        $registry = ColumnType::builtin();
        foreach ($types as $type) {
            $registry[$type->name] = $type;
        }
        $byId = [];
        foreach (array_map(Column::fromArray(...), $columns) as $column) {
            if (isset($byId[$column->id])) {
                throw new InvalidArgumentException("Duplicate column id \"{$column->id}\"");
            }
            if (! isset($registry[$column->type])) {
                throw new InvalidArgumentException("Column \"{$column->id}\" uses unknown type \"{$column->type}\"");
            }
            $byId[$column->id] = $column;
        }

        return new self($byId, $key, $registry);
    }

    public function column(string $id): ?Column
    {
        return $this->columns[$id] ?? null;
    }

    public function typeOf(Column $column): ColumnType
    {
        return $this->types[$column->type];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function definitions(): array
    {
        return array_values(array_map(fn (Column $column): array => $column->definition, $this->columns));
    }
}
