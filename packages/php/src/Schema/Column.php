<?php

declare(strict_types=1);

namespace Tally\Laravel\Schema;

use InvalidArgumentException;

final readonly class Column
{
    /**
     * @param  array<string, mixed>  $definition
     * @param  list<string>  $options
     */
    private function __construct(
        public string $id,
        public string $type,
        public array $definition,
        public array $options,
    ) {}

    /**
     * @param  array<array-key, mixed>  $definition
     */
    public static function fromArray(array $definition): self
    {
        $id = $definition['id'] ?? null;
        if (! is_string($id) || $id === '') {
            throw new InvalidArgumentException('Every column needs a non empty string id');
        }
        $type = $definition['type'] ?? 'text';
        if (! is_string($type) || $type === '') {
            throw new InvalidArgumentException("Column \"{$id}\" has an invalid type");
        }
        $options = $definition['options'] ?? [];
        $values = is_array($options) ? array_map(
            fn (mixed $option): string => is_array($option) && is_string($option['value'] ?? null)
                ? $option['value']
                : throw new InvalidArgumentException("Column \"{$id}\" has an invalid option"),
            array_values($options),
        ) : throw new InvalidArgumentException("Column \"{$id}\" has invalid options");
        $normalized = [];
        foreach ($definition as $key => $value) {
            $normalized[(string) $key] = $value;
        }

        return new self($id, $type, [...$normalized, 'type' => $type], $values);
    }

    public function allows(string $capability): bool
    {
        return ($this->definition[$capability] ?? null) !== false;
    }

    public function flag(string $capability): ?bool
    {
        $value = $this->definition[$capability] ?? null;

        return is_bool($value) ? $value : null;
    }
}
