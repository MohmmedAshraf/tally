<?php

declare(strict_types=1);

namespace Tally\Laravel\Schema;

enum Kind: string
{
    case Text = 'text';
    case Number = 'number';
    case Date = 'date';
    case Boolean = 'boolean';
    case Enum = 'enum';

    public function isString(): bool
    {
        return $this === self::Text || $this === self::Enum;
    }
}
