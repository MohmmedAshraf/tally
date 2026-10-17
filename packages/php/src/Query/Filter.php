<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

use Tally\Laravel\Support\Input;

abstract readonly class Filter
{
    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function fromArray(array $input): self
    {
        return match (Input::string($input, 'type')) {
            'condition' => new Condition(
                Input::string($input, 'column'),
                Operator::from(Input::string($input, 'op')),
                $input['value'] ?? null,
                array_key_exists('value', $input),
            ),
            'and' => new AllOf(self::many($input)),
            'or' => new AnyOf(self::many($input)),
            'not' => new Not(self::fromArray(Input::array($input, 'filter'))),
            'search' => new Search(Input::string($input, 'text')),
            'flag' => new Flag(Input::string($input, 'name')),
            default => throw Input::invalid('type'),
        };
    }

    /**
     * @param  array<array-key, mixed>  $input
     * @return list<self>
     */
    private static function many(array $input): array
    {
        return array_map(self::fromArray(...), Input::arrays($input, 'filters'));
    }
}
