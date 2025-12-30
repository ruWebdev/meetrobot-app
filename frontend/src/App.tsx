import React from 'react';
import WebApp from '@twa-dev/sdk';

import CreateEventPage from './pages/CreateEventPage';
import EventDetailsPage from './pages/EventDetailsPage';

function matchCreateEventRoute(pathname: string): { workspaceId: string } | null {
    const match = pathname.match(/^\/workspaces\/([^/]+)\/events\/create\/?$/);
    if (!match) return null;
    return { workspaceId: match[1] };
}

function matchEventDetailsRoute(pathname: string): { workspaceId: string; eventId: string } | null {
    const match = pathname.match(/^\/workspaces\/([^/]+)\/events\/([^/]+)\/?$/);
    if (!match) return null;
    return { workspaceId: match[1], eventId: match[2] };
}

function App() {
    try {
        const scheme = WebApp.colorScheme;
        if (scheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } catch {
        // ignore (например, запуск вне Telegram)
    }

    const pathname = window.location.pathname;

    const createRoute = matchCreateEventRoute(pathname);
    if (createRoute) {
        return <CreateEventPage workspaceId={createRoute.workspaceId} />;
    }

    const detailsRoute = matchEventDetailsRoute(pathname);
    if (detailsRoute) {
        return <EventDetailsPage workspaceId={detailsRoute.workspaceId} eventId={detailsRoute.eventId} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="mx-auto max-w-2xl p-4">
                <h1 className="text-xl font-semibold">MeetRobot</h1>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">Неизвестный маршрут.</div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <div className="font-medium">Ожидаемые пути:</div>
                    <div className="mt-2 space-y-1 font-mono text-xs">
                        <div>/workspaces/:workspaceId/events/create</div>
                        <div>/workspaces/:workspaceId/events/:eventId</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
