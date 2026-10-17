<?php

declare(strict_types=1);

namespace Tally\Laravel\Tests;

use Orchestra\Testbench\TestCase as Orchestra;
use Tally\Laravel\TallyServiceProvider;

abstract class TestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [TallyServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $driver = getenv('DB_CONNECTION') ?: 'sqlite';
        $app['config']->set('database.default', 'tally');
        $app['config']->set('database.connections.tally', $driver === 'sqlite'
            ? ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]
            : [
                'driver' => $driver,
                'host' => getenv('DB_HOST') ?: '127.0.0.1',
                'port' => getenv('DB_PORT') ?: ($driver === 'pgsql' ? '5432' : '3306'),
                'database' => getenv('DB_DATABASE') ?: 'tally',
                'username' => getenv('DB_USERNAME') ?: 'root',
                'password' => getenv('DB_PASSWORD') ?: '',
                'charset' => $driver === 'pgsql' ? 'utf8' : 'utf8mb4',
                'prefix' => '',
                'strict' => true,
            ]);
    }
}
