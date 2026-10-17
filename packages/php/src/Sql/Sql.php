<?php

declare(strict_types=1);

namespace Tally\Laravel\Sql;

use Illuminate\Database\Query\Expression;

final readonly class Sql
{
    /**
     * @param  list<mixed>  $bindings
     */
    public function __construct(
        public string $sql,
        public array $bindings = [],
    ) {}

    /**
     * @return Expression<float|int|literal-string>
     */
    public function expression(): Expression
    {
        return new Expression($this->sql);
    }

    public static function value(mixed $value): self
    {
        return new self('?', [$value]);
    }

    public static function true(): self
    {
        return new self('1 = 1');
    }

    public static function false(): self
    {
        return new self('1 = 0');
    }

    /**
     * @param  list<self>  $parts
     */
    public static function join(array $parts, string $glue): self
    {
        return new self(
            implode($glue, array_map(fn (self $part): string => $part->sql, $parts)),
            array_merge(...array_map(fn (self $part): array => $part->bindings, $parts)),
        );
    }

    public static function of(string $template, self ...$parts): self
    {
        $pieces = explode('{}', $template);
        $sql = array_shift($pieces);
        $bindings = [];
        foreach ($parts as $index => $part) {
            $sql .= $part->sql.($pieces[$index] ?? '');
            array_push($bindings, ...$part->bindings);
        }

        return new self($sql, $bindings);
    }
}
