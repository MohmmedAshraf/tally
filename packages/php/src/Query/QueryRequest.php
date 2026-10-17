<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

use Tally\Laravel\Support\Input;

final readonly class QueryRequest
{
    /**
     * @param  list<Sort>  $sort
     * @param  list<Aggregate>  $aggregates
     * @param  list<string>|null  $facets
     */
    public function __construct(
        public array $sort = [],
        public ?Filter $filter = null,
        public ?Group $group = null,
        public ?Page $page = null,
        public array $aggregates = [],
        public ?array $facets = null,
    ) {}

    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function fromArray(array $input): self
    {
        $group = Input::optionalArray($input, 'group');
        $page = Input::optionalArray($input, 'page');
        $granularity = $group === null ? null : Input::optionalString($group, 'granularity');

        return new self(
            sort: array_map(
                fn (array $sort): Sort => new Sort(Input::string($sort, 'column'), Direction::from(Input::string($sort, 'direction'))),
                Input::arrays($input, 'sort'),
            ),
            filter: ($filter = Input::optionalArray($input, 'filter')) === null ? null : Filter::fromArray($filter),
            group: $group === null ? null : new Group(
                Input::string($group, 'column'),
                $granularity === null ? null : Granularity::from($granularity),
            ),
            page: $page === null ? null : new Page(
                Input::int($page, 'limit'),
                Input::optionalInt($page, 'offset'),
                Input::optionalString($page, 'cursor'),
            ),
            aggregates: array_map(
                fn (array $aggregate): Aggregate => new Aggregate(Input::string($aggregate, 'column'), AggregateFn::from(Input::string($aggregate, 'fn'))),
                array_key_exists('aggregates', $input) ? Input::arrays($input, 'aggregates') : [],
            ),
            facets: array_key_exists('facets', $input) ? Input::strings($input, 'facets') : null,
        );
    }
}
