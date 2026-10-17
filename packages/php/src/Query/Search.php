<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

final readonly class Search extends Filter
{
    public function __construct(public string $text) {}
}
