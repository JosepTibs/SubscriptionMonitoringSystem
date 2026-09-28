<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withEvents(discover: false)  
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Render styled Inertia error pages for 403/404 on browser requests.
        // JSON/API requests keep Laravel's default JSON error payloads.
        $exceptions->render(function (HttpException $e, Request $request) {
            $status = $e->getStatusCode();

            if (! in_array($status, [Response::HTTP_FORBIDDEN, Response::HTTP_NOT_FOUND])) {
                return null; // fall back to default handling
            }

            if ($request->expectsJson() || str_starts_with($request->path(), 'api/')) {
                return null;
            }

            return Inertia::render("errors/{$status}", ['status' => $status])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
