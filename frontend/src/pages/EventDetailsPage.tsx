import React, { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';

export default function EventDetailsPage(props: { workspaceId: string; eventId: string }) {
    useEffect(() => {
        try {
            WebApp.ready();
            WebApp.expand();
        } catch {
            // ignore
        }
    }, []);

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
            <h1 style={{ marginTop: 0 }}>Событие</h1>
            <div style={{ color: '#666' }}>Заглушка экрана (по ТЗ допускается).</div>

            <div style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#666' }}>Workspace</div>
                <div style={{ wordBreak: 'break-all' }}>{props.workspaceId}</div>

                <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>Event ID</div>
                <div style={{ wordBreak: 'break-all' }}>{props.eventId}</div>
            </div>
        </div>
    );
}
