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
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="mx-auto max-w-2xl p-4">
                <h1 className="text-xl font-semibold">Событие</h1>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">Заглушка экрана (допускается по ТЗ).</div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Рабочее пространство</div>
                    <div className="break-all font-mono text-sm">{props.workspaceId}</div>

                    <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">ID события</div>
                    <div className="break-all font-mono text-sm">{props.eventId}</div>
                </div>
            </div>
        </div>
    );
}
