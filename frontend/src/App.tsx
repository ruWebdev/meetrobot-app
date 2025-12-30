import React from 'react';

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
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
            <h1 style={{ marginTop: 0 }}>MeetRobot Web App</h1>
            <div style={{ color: '#666' }}>Неизвестный маршрут.</div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
                Ожидаемые пути:
                <div>
                    <code>/workspaces/:workspaceId/events/create</code>
                </div>
                <div>
                    <code>/workspaces/:workspaceId/events/:eventId</code>
                </div>
            </div>
        </div>
    );
}

export default App;
