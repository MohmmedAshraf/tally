<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Tally\Laravel\Schema\Column;
use Tally\Laravel\Schema\ColumnType;

final readonly class Target
{
    public function __construct(
        public Column $column,
        public ColumnType $type,
        public Sql $ref,
    ) {}

    public function with(Sql $ref): self
    {
        return new self($this->column, $this->type, $ref);
    }
}
