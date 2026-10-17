<?php

declare(strict_types=1);

namespace Tally\Laravel\Query;

use Tally\Laravel\Support\Dates;

final readonly class RelativeRange
{
    private const array DIRECTIONS = ['last', 'next', 'this'];

    private const array UNITS = ['day', 'week', 'month', 'quarter', 'year'];

    private function __construct(
        public string $direction,
        public int $amount,
        public string $unit,
        public int $shift,
    ) {}

    public static function from(mixed $value): ?self
    {
        if (! is_array($value) || array_diff(array_keys($value), ['direction', 'amount', 'unit', 'shift']) !== []) {
            return null;
        }
        $direction = $value['direction'] ?? null;
        $amount = $value['amount'] ?? null;
        $unit = $value['unit'] ?? null;
        $shift = $value['shift'] ?? 0;
        if (! in_array($direction, self::DIRECTIONS, true) || ! in_array($unit, self::UNITS, true)) {
            return null;
        }
        if (! is_int($amount) || $amount < 0 || ! is_int($shift)) {
            return null;
        }

        return new self($direction, $amount, $unit, $shift);
    }

    /**
     * @return array{string, string}
     */
    public function resolve(string $today): array
    {
        if ($this->direction === 'this') {
            $start = $this->add($this->startOfUnit($today), $this->shift);

            return [$start, Dates::addDays($this->add($start, 1), -1)];
        }
        if ($this->direction === 'last') {
            return [$this->add($today, -$this->amount), $today];
        }

        return [$today, $this->add($today, $this->amount)];
    }

    private function startOfUnit(string $date): string
    {
        [$year, $month] = array_map(intval(...), explode('-', $date));

        return match ($this->unit) {
            'day' => $date,
            'week' => Dates::addDays($date, 1 - Dates::dayOfWeek($date)),
            'month' => sprintf('%04d-%02d-01', $year, $month),
            'quarter' => sprintf('%04d-%02d-01', $year, intdiv($month - 1, 3) * 3 + 1),
            default => sprintf('%04d-01-01', $year),
        };
    }

    private function add(string $date, int $amount): string
    {
        return match ($this->unit) {
            'day' => Dates::addDays($date, $amount),
            'week' => Dates::addDays($date, $amount * 7),
            'month' => Dates::addMonths($date, $amount),
            'quarter' => Dates::addMonths($date, $amount * 3),
            default => Dates::addMonths($date, $amount * 12),
        };
    }
}
