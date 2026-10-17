<?php

declare(strict_types=1);

namespace Tally\Laravel;

use Illuminate\Http\JsonResponse;
use RuntimeException;

final class TallyException extends RuntimeException
{
    /**
     * @param  list<string>  $details
     */
    public function __construct(
        public readonly string $type,
        string $message,
        public readonly array $details = [],
        public readonly int $status = 400,
    ) {
        parent::__construct($message);
    }

    /**
     * @param  list<string>  $details
     */
    public static function invalidQuery(string $message, array $details = []): self
    {
        return new self('invalid_query', $message, $details);
    }

    public static function readOnly(): self
    {
        return new self('read_only', 'Source is read only', status: 405);
    }

    public static function notFound(string $message): self
    {
        return new self('not_found', $message, status: 404);
    }

    public function render(): JsonResponse
    {
        return new JsonResponse([
            'code' => $this->type,
            'message' => $this->getMessage(),
            'details' => $this->details,
        ], $this->status);
    }
}
