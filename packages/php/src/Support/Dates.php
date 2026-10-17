<?php

declare(strict_types=1);

namespace Tally\Laravel\Support;

use DateTimeImmutable;
use DateTimeZone;

final class Dates
{
    public static function isIso(string $value): bool
    {
        return preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $parts) === 1
            && checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]);
    }

    public static function fromDayNumber(int $day): string
    {
        return self::parse('1970-01-01')->modify("{$day} days")->format('Y-m-d');
    }

    public static function addDays(string $date, int $days): string
    {
        return self::parse($date)->modify("{$days} days")->format('Y-m-d');
    }

    public static function addMonths(string $date, int $months): string
    {
        $origin = self::parse($date);
        $index = (int) $origin->format('Y') * 12 + (int) $origin->format('n') - 1 + $months;
        $first = self::parse(sprintf('%04d-%02d-01', intdiv($index, 12), $index % 12 + 1));
        $day = min((int) $origin->format('j'), (int) $first->format('t'));

        return $first->modify(($day - 1).' days')->format('Y-m-d');
    }

    public static function dayOfWeek(string $date): int
    {
        return (int) self::parse($date)->format('N');
    }

    private static function parse(string $date): DateTimeImmutable
    {
        return new DateTimeImmutable($date, new DateTimeZone('UTC'));
    }
}
