<?php

declare(strict_types=1);

namespace Tally\Laravel\Http;

use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use JsonException;
use Tally\Laravel\Adapter;
use Tally\Laravel\Grid;
use Tally\Laravel\Mutation\Mutation;
use Tally\Laravel\Protocol\Issues;
use Tally\Laravel\Protocol\JsonSchema;
use Tally\Laravel\Query\QueryRequest;
use Tally\Laravel\Support\Input;
use Tally\Laravel\TallyException;

final readonly class TallyController
{
    public function __construct(private Container $container) {}

    public function schema(Request $request): JsonResponse
    {
        return new JsonResponse($this->adapter($request)->describe());
    }

    public function query(Request $request): JsonResponse
    {
        $adapter = $this->adapter($request);
        $input = $this->body($request, 'query-request', 'Query request');

        return new JsonResponse($adapter->query(QueryRequest::fromArray($input)));
    }

    public function rows(Request $request): JsonResponse
    {
        $adapter = $this->adapter($request);
        if (! $adapter->capabilities()['mutate']) {
            throw TallyException::readOnly();
        }
        $input = $this->body($request, 'mutation-request', 'Mutation request');
        $mutations = array_map(Mutation::fromArray(...), Input::arrays($input, 'mutations'));
        $issues = (new Issues($adapter->schema))->mutations($mutations);
        if ($issues !== []) {
            throw TallyException::invalidQuery('Mutation request is invalid', $issues);
        }

        return new JsonResponse($adapter->mutate($mutations));
    }

    public function events(): never
    {
        throw TallyException::notFound('Live events are not supported yet');
    }

    private function adapter(Request $request): Adapter
    {
        $class = $request->route()?->defaults['tally.grid'] ?? null;
        $grid = is_string($class) ? $this->container->make($class) : null;
        if (! $grid instanceof Grid) {
            throw TallyException::notFound('Not found');
        }
        $handler = $this->container->bound(ExceptionHandler::class) ? $this->container->make(ExceptionHandler::class) : null;

        return new Adapter($grid, $handler instanceof ExceptionHandler ? $handler : null);
    }

    /**
     * @return array<array-key, mixed>
     */
    private function body(Request $request, string $schema, string $subject): array
    {
        try {
            $data = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw TallyException::invalidQuery('Request body is not valid JSON');
        }
        $issues = JsonSchema::issues($schema, $data);
        if ($issues !== []) {
            throw TallyException::invalidQuery("{$subject} is invalid", $issues);
        }
        $input = json_decode($request->getContent(), true);

        return is_array($input) ? $input : [];
    }
}
