<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Page
{
    public function __construct(
        public int $limit,
        public ?int $offset = null,
        public ?string $cursor = null,
    ) {}
}
