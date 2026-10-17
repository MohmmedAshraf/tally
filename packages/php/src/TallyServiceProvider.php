<?php

declare(strict_types=1);

namespace Tally\Laravel;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Tally\Laravel\Http\TallyController;

final class TallyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::macro('tally', function (string $uri, string $grid): void {
            $base = rtrim($uri, '/');
            Route::get("{$base}/schema", [TallyController::class, 'schema'])->defaults('tally.grid', $grid);
            Route::post("{$base}/query", [TallyController::class, 'query'])->defaults('tally.grid', $grid);
            Route::patch("{$base}/rows", [TallyController::class, 'rows'])->defaults('tally.grid', $grid);
            Route::get("{$base}/events", [TallyController::class, 'events'])->defaults('tally.grid', $grid);
        });
    }
}
