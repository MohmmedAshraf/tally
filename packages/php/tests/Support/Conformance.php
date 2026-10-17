<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class Conformance
{
    public const string TABLE = 'accounts';

    private const float TOLERANCE = 1e-6;

    /** @var array<string, mixed>|null */
    private static ?array $fixture = null;

    /**
     * @return array<string, mixed>
     */
    public static function fixture(): array
    {
        if (self::$fixture === null) {
            $decoded = json_decode((string) file_get_contents(__DIR__.'/../Fixtures/conformance.json'), true);
            self::$fixture = is_array($decoded) ? $decoded : [];
        }

        return self::$fixture;
    }

    public static function today(): string
    {
        return self::fixture()['today'];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function columns(): array
    {
        return self::fixture()['columns'];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function rows(): array
    {
        return self::fixture()['rows'];
    }

    /**
     * @return array<string, array{array<string, mixed>}>
     */
    public static function cases(string $set = 'cases'): array
    {
        $cases = [];
        foreach (self::fixture()[$set] as $case) {
            $cases[$case['name']] = [$case];
        }

        return $cases;
    }

    public static function seed(): void
    {
        Schema::dropIfExists(self::TABLE);
        Schema::create(self::TABLE, function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('account')->nullable();
            $table->string('owner')->nullable();
            $table->string('plan')->nullable();
            $table->double('mrr')->nullable();
            $table->integer('seats')->nullable();
            $table->double('score')->nullable();
            $table->double('growth')->nullable();
            $table->integer('health')->nullable();
            $table->date('renewal')->nullable();
            $table->boolean('active')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->integer('tenure')->nullable();
        });
        DB::table(self::TABLE)->insert(self::rows());
    }

    /**
     * @param  array<string, mixed>  $expected
     * @param  array<string, mixed>  $actual
     * @return list<string>
     */
    public static function diff(array $expected, array $actual): array
    {
        $diffs = [
            ...self::rowsDiff($expected['rows'], $actual['rows'] ?? []),
            ...self::value('total', $expected['total'] ?? null, $actual['total'] ?? null),
            ...self::value('matched', $expected['matched'] ?? null, $actual['matched'] ?? null),
            ...self::groups($expected['groups'] ?? null, $actual['groups'] ?? null),
        ];
        if (array_key_exists('aggregates', $expected)) {
            array_push($diffs, ...self::record('aggregates', $expected['aggregates'], $actual['aggregates'] ?? null));
        }
        if (array_key_exists('facets', $expected)) {
            foreach ($expected['facets'] as $id => $facet) {
                array_push($diffs, ...self::facet("facets.{$id}", $facet, $actual['facets'][$id] ?? null));
            }
        }

        return $diffs;
    }

    /**
     * @param  list<string>  $keys
     * @param  list<array<string, mixed>>  $actual
     * @return list<string>
     */
    private static function rowsDiff(array $keys, array $actual): array
    {
        $actualKeys = array_column($actual, 'id');
        if (count($keys) !== count($actual)) {
            return ['rows: expected '.count($keys).' rows, got '.count($actual), 'rows: expected keys '.json_encode($keys).', got '.json_encode($actualKeys)];
        }
        $fixture = array_column(self::rows(), null, 'id');
        $diffs = [];
        foreach ($keys as $index => $key) {
            if ($actualKeys[$index] !== $key) {
                $diffs[] = "rows[{$index}]: expected key {$key}, got ".json_encode($actualKeys[$index]);

                continue;
            }
            foreach (self::columns() as $column) {
                $id = $column['id'];
                array_push($diffs, ...self::value("rows[{$index}].{$id}", $fixture[$key][$id] ?? null, $actual[$index][$id] ?? null));
            }
        }

        return $diffs;
    }

    /**
     * @return list<string>
     */
    private static function groups(?array $expected, ?array $actual): array
    {
        if ($expected === null) {
            return $actual === null ? [] : ['groups: unexpected'];
        }
        if ($actual === null) {
            return ['groups: missing'];
        }
        if (count($expected) !== count($actual)) {
            return ['groups: expected '.count($expected).' groups, got '.count($actual)];
        }
        $diffs = [];
        foreach ($expected as $index => $group) {
            $other = $actual[$index];
            if ($group['key'] !== $other['key']) {
                $diffs[] = "groups[{$index}].key: expected {$group['key']}, got ".json_encode($other['key']);

                continue;
            }
            array_push(
                $diffs,
                ...self::value("groups[{$index}].value", $group['value'] ?? null, $other['value'] ?? null),
                ...self::value("groups[{$index}].count", $group['count'], $other['count'] ?? null),
                ...self::record("groups[{$index}].aggregates", $group['aggregates'], $other['aggregates'] ?? null),
            );
        }

        return $diffs;
    }

    /**
     * @return list<string>
     */
    private static function facet(string $path, array $expected, ?array $actual): array
    {
        if ($actual === null) {
            return ["{$path}: missing"];
        }
        if ($expected['kind'] !== $actual['kind']) {
            return ["{$path}.kind: expected {$expected['kind']}, got {$actual['kind']}"];
        }
        if ($expected['kind'] === 'terms') {
            $diffs = self::value("{$path}.distinct", $expected['distinct'], $actual['distinct']);
            $counts = [];
            foreach ($actual['terms'] as $term) {
                $counts[self::termKey($term['value'])] = $term['count'];
            }
            if (count($expected['terms']) !== count($actual['terms'])) {
                $diffs[] = "{$path}.terms: expected ".count($expected['terms']).' terms, got '.count($actual['terms']);
            }
            foreach ($expected['terms'] as $term) {
                $key = self::termKey($term['value']);
                array_push($diffs, ...self::value("{$path}.terms[{$key}]", $term['count'], $counts[$key] ?? null));
            }

            return $diffs;
        }
        $diffs = [
            ...self::value("{$path}.min", $expected['min'] ?? null, $actual['min'] ?? null),
            ...self::value("{$path}.max", $expected['max'] ?? null, $actual['max'] ?? null),
        ];
        if (count($expected['bins']) !== count($actual['bins'])) {
            return [...$diffs, "{$path}.bins: expected ".count($expected['bins']).' bins, got '.count($actual['bins'])];
        }
        foreach ($expected['bins'] as $index => $bin) {
            foreach (['start', 'end', 'count'] as $field) {
                array_push($diffs, ...self::value("{$path}.bins[{$index}].{$field}", $bin[$field], $actual['bins'][$index][$field] ?? null));
            }
        }

        return $diffs;
    }

    /**
     * @return list<string>
     */
    private static function record(string $path, ?array $expected, ?array $actual): array
    {
        if ($actual === null) {
            return ["{$path}: missing"];
        }
        $diffs = [];
        foreach (array_unique([...array_keys($expected ?? []), ...array_keys($actual)]) as $key) {
            array_push($diffs, ...self::value("{$path}.{$key}", $expected[$key] ?? null, $actual[$key] ?? null));
        }

        return $diffs;
    }

    /**
     * @return list<string>
     */
    private static function value(string $path, mixed $expected, mixed $actual): array
    {
        return self::close($expected, $actual) ? [] : ["{$path}: expected ".json_encode($expected).', got '.json_encode($actual)];
    }

    private static function close(mixed $a, mixed $b): bool
    {
        if (($a === null || $a === '') && ($b === null || $b === '')) {
            return true;
        }
        if ((is_int($a) || is_float($a)) && (is_int($b) || is_float($b))) {
            return abs($a - $b) <= self::TOLERANCE * max(1, abs($a), abs($b));
        }

        return $a === $b;
    }

    private static function termKey(mixed $value): string
    {
        return (string) json_encode(is_float($value) && floor($value) === $value ? (int) $value : $value);
    }
}
