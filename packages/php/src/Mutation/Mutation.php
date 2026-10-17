<?php

declare(strict_types=1);

namespace Tally\Laravel\Mutation;

use Tally\Laravel\Support\Input;

final readonly class Mutation
{
    /**
     * @param  list<Change>  $changes
     * @param  list<array<array-key, mixed>>  $inserted
     * @param  list<array<array-key, mixed>>  $deleted
     */
    public function __construct(
        public array $changes = [],
        public array $inserted = [],
        public array $deleted = [],
    ) {}

    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function fromArray(array $input): self
    {
        return new self(
            array_map(fn (array $change): Change => new Change(
                self::key($change['key'] ?? null),
                Input::string($change, 'column'),
                $change['to'] ?? null,
            ), Input::arrays($input, 'changes')),
            array_map(fn (array $insert): array => Input::array($insert, 'row'), Input::arrays($input, 'inserted')),
            array_map(fn (array $removal): array => Input::array($removal, 'row'), Input::arrays($input, 'deleted')),
        );
    }

    private static function key(mixed $value): string|int|float
    {
        return is_string($value) || is_int($value) || is_float($value) ? $value : throw Input::invalid('key');
    }
}
