import React, { useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { ApiError, getEventDetails } from '../api/events.api';
import { EventDetails } from '../types/events';

function getQueryParam(name: string): string | null {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function getUserId(): string {
    const fromQuery = getQueryParam('userId');
    if (fromQuery) {
        try {
            localStorage.setItem('userId', fromQuery);
        } catch {
            // ignore
        }
        return fromQuery;
    }

    try {
        return localStorage.getItem('userId') ?? '';
    } catch {
        return '';
    }
}

function errorMessageByStatus(status: number, backendMessage: string): string {
    if (status === 400) return backendMessage || 'Некорректные данные';
    if (status === 401) return 'Нет авторизации';
    if (status === 403) return 'Недостаточно прав для просмотра события';
    if (status === 404) return 'Событие не найдено';
    if (status >= 500) return 'Непредвиденная ошибка';
    return backendMessage || `Ошибка ${status}`;
}

function formatDateTime(value: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ru-RU');
}

function mapStatus(status: EventDetails['participants'][number]['participationStatus']): string {
    if (status === 'confirmed') return '✅ Подтвердил';
    if (status === 'declined') return '❌ Отказался';
    if (status === 'tentative') return '❔ Под вопросом';
    return '📨 Приглашён';
}

function formatUserName(user: EventDetails['participants'][number]['user']): string {
    if (!user) return 'Без имени';
    const base = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (base) return base;
    if (user.username) return `@${user.username}`;
    return 'Без имени';
}

export default function EventDetailsPage(props: { workspaceId: string; eventId: string; onNavigate: (path: string) => void }) {
    const { workspaceId, eventId, onNavigate } = props;

    const userId = useMemo(() => getUserId(), []);
    const apiBaseUrl = useMemo(() => getQueryParam('apiBaseUrl') ?? 'http://localhost:3000', []);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<EventDetails | null>(null);

    useEffect(() => {
        try {
            WebApp.ready();
            WebApp.expand();
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const data = await getEventDetails({ apiBaseUrl, userId, eventId });
                if (cancelled) return;
                setDetails(data);
            } catch (e: any) {
                const apiError = e as ApiError;
                if (typeof apiError?.status === 'number') {
                    setError(errorMessageByStatus(apiError.status, apiError.message));
                } else {
                    setError('Непредвиденная ошибка');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [apiBaseUrl, userId, eventId]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Event</div>
                        <h1 className="text-2xl font-semibold">Карточка события</h1>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Просмотр события и статусов участников.
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onNavigate(`/workspaces/${workspaceId}`)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Вернуться
                    </button>
                </div>

                {loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        Загрузка…
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100">
                        <div className="font-semibold">Ошибка</div>
                        <div className="mt-1 whitespace-pre-wrap">{error}</div>
                    </div>
                ) : null}

                {details ? (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Детали</div>
                            <div className="mt-3 text-xl font-semibold">{details.title}</div>
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Статус: <span className="font-semibold text-slate-700 dark:text-slate-200">{details.status}</span>
                            </div>

                            <div className="mt-4 grid gap-3 text-sm">
                                <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Начало</div>
                                    <div className="font-medium text-slate-800 dark:text-slate-100">{formatDateTime(details.startAt)}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Окончание</div>
                                    <div className="font-medium text-slate-800 dark:text-slate-100">{formatDateTime(details.endAt)}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">Описание</div>
                                    <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                                        {details.description || '—'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100">
                            <div className="text-xs uppercase tracking-[0.2em]">Участники</div>
                            <div className="mt-3 space-y-3">
                                {details.participants.map((participant) => (
                                    <div
                                        key={participant.userId}
                                        className="rounded-xl border border-emerald-200/70 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900/70 dark:text-slate-100"
                                    >
                                        <div className="font-medium">{formatUserName(participant.user)}</div>
                                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                            {mapStatus(participant.participationStatus)}{participant.role === 'organizer' ? ' · организатор' : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
