<?php

declare(strict_types=1);

namespace Tally\Laravel\Protocol;

use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Schema;
use Opis\JsonSchema\Validator;
use RuntimeException;

final class JsonSchema
{
    private static ?Validator $validator = null;

    /** @var array<string, Schema> */
    private static array $schemas = [];

    /**
     * @return list<string>
     */
    public static function issues(string $name, mixed $data): array
    {
        $validator = self::$validator ??= new Validator(max_errors: 10, stop_at_first_error: false);
        $error = $validator->validate($data, self::schema($validator, $name))->error();
        if ($error === null) {
            return [];
        }
        $issues = [];
        foreach ((new ErrorFormatter)->format($error, false) as $pointer => $message) {
            $path = str_replace('/', '.', ltrim((string) $pointer, '/'));
            $issues[] = $path.': '.(is_string($message) ? $message : 'is invalid');
        }

        return $issues;
    }

    private static function schema(Validator $validator, string $name): Schema
    {
        if (! isset(self::$schemas[$name])) {
            $document = json_decode((string) file_get_contents(dirname(__DIR__, 2)."/resources/schemas/{$name}.json"));
            if (! is_object($document)) {
                throw new RuntimeException("Missing Tally JSON Schema \"{$name}\"");
            }
            self::$schemas[$name] = $validator->loader()->loadObjectSchema($document);
        }

        return self::$schemas[$name];
    }
}
