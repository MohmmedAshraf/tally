<?php

declare(strict_types=1);

namespace Tally\Laravel\Support;

use Tally\Laravel\TallyException;

final class Input
{
    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function string(array $input, string $key): string
    {
        return self::optionalString($input, $key) ?? throw self::invalid($key);
    }

    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function optionalString(array $input, string $key): ?string
    {
        $value = $input[$key] ?? null;

        return match (true) {
            $value === null => null,
            is_string($value) => $value,
            default => throw self::invalid($key),
        };
    }

    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function int(array $input, string $key): int
    {
        return self::optionalInt($input, $key) ?? throw self::invalid($key);
    }

    /**
     * @param  array<array-key, mixed>  $input
     */
    public static function optionalInt(array $input, string $key): ?int
    {
        $value = $input[$key] ?? null;

        return match (true) {
            $value === null => null,
            is_int($value) => $value,
            default => throw self::invalid($key),
        };
    }

    /**
     * @param  array<array-key, mixed>  $input
     * @return array<array-key, mixed>
     */
    public static function array(array $input, string $key): array
    {
        return self::optionalArray($input, $key) ?? throw self::invalid($key);
    }

    /**
     * @param  array<array-key, mixed>  $input
     * @return array<array-key, mixed>|null
     */
    public static function optionalArray(array $input, string $key): ?array
    {
        $value = $input[$key] ?? null;

        return match (true) {
            $value === null => null,
            is_array($value) => $value,
            default => throw self::invalid($key),
        };
    }

    /**
     * @param  array<array-key, mixed>  $input
     * @return list<array<array-key, mixed>>
     */
    public static function arrays(array $input, string $key): array
    {
        return array_map(
            fn (mixed $item): array => is_array($item) ? $item : throw self::invalid($key),
            array_values(self::array($input, $key)),
        );
    }

    /**
     * @param  array<array-key, mixed>  $input
     * @return list<string>
     */
    public static function strings(array $input, string $key): array
    {
        return array_map(
            fn (mixed $item): string => is_string($item) ? $item : throw self::invalid($key),
            array_values(self::array($input, $key)),
        );
    }

    public static function invalid(string $key): TallyException
    {
        return TallyException::invalidQuery('Request is invalid', ["{$key}: unexpected value"]);
    }
}
