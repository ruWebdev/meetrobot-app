import React, { useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { ApiError, createEvent } from '../api/events.api';
import { CreateEventPayload } from '../types/events';

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
    if (status === 403) return 'Недостаточно прав для создания события';
    if (status === 404) return 'Рабочее пространство не найдено';
    if (status >= 500) return 'Непредвиденная ошибка';
    return backendMessage || `Ошибка ${status}`;
}

function toIso(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

export default function CreateEventPage(props: { workspaceId: string; onNavigate: (path: string) => void }) {
    const { workspaceId, onNavigate } = props;

    const userId = useMemo(() => getUserId(), []);
    const apiBaseUrl = useMemo(() => getQueryParam('apiBaseUrl') ?? 'http://localhost:3000', []);
    const querySuffix = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        const value = params.toString();
        return value ? `?${value}` : '';
    }, []);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createdEventId, setCreatedEventId] = useState<string | null>(null);

    useEffect(() => {
        try {
            WebApp.ready();
            WebApp.expand();
        } catch {
            // ignore (например, вне Telegram)
        }
    }, []);

    const canSubmit = Boolean(workspaceId && userId && title.trim() && startAt && endAt);

    const submit = async () => {
        setError(null);

        const startIso = toIso(startAt);
        const endIso = toIso(endAt);

        if (!startIso || !endIso) {
            setError('Заполните корректные дату и время начала/окончания');
            return;
        }

        const payload: CreateEventPayload = {
            workspaceId,
            title: title.trim(),
            description: description.trim() ? description.trim() : undefined,
            startAt: startIso,
            endAt: endIso,
        };

        setIsSubmitting(true);
        try {
            const result = await createEvent({ apiBaseUrl, userId, payload });
            setCreatedEventId(result.id);
        } catch (e: any) {
            const apiError = e as ApiError;
            if (typeof apiError?.status === 'number') {
                setError(errorMessageByStatus(apiError.status, apiError.message));
                return;
            }

            setError('Непредвиденная ошибка');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
            <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-sm uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Event</div>
                        <h1 className="text-2xl font-semibold">Создание события</h1>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            Заполните основные параметры и создайте событие в статусе draft.
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

                {createdEventId ? (
                    <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900/40 dark:bg-slate-900">
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Событие создано</div>
                        <div className="mt-2 text-lg font-semibold">Черновик готов</div>
                        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                            {createdEventId}
                        </div>
                        <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                            Дальше можно открыть карточку события и посмотреть участников.
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={() => onNavigate(`/workspaces/${workspaceId}/events/${createdEventId}`)}
                                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
                            >
                                Открыть событие
                            </button>
                            <button
                                type="button"
                                onClick={() => setCreatedEventId(null)}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Создать ещё
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="grid gap-4">
                                <label className="grid gap-2">
                                    <div className="text-sm font-medium">Название <span className="text-rose-500">*</span></div>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Например: Презентация продукта"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-800 dark:bg-slate-950"
                                    />
                                </label>

                                <label className="grid gap-2">
                                    <div className="text-sm font-medium">Описание</div>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Опишите цель или формат события"
                                        className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-800 dark:bg-slate-950"
                                    />
                                </label>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="grid gap-2">
                                        <div className="text-sm font-medium">Начало <span className="text-rose-500">*</span></div>
                                        <input
                                            type="datetime-local"
                                            value={startAt}
                                            onChange={(e) => setStartAt(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-800 dark:bg-slate-950"
                                        />
                                    </label>
                                    <label className="grid gap-2">
                                        <div className="text-sm font-medium">Окончание <span className="text-rose-500">*</span></div>
                                        <input
                                            type="datetime-local"
                                            value={endAt}
                                            onChange={(e) => setEndAt(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-800 dark:bg-slate-950"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                            <div className="text-xs uppercase tracking-[0.2em]">Подсказка</div>
                            <div className="mt-2 font-semibold">Draft без сценариев</div>
                            <div className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
                                Черновик не рассылает уведомлений и не ставит задачи в очередь. Приглашения запускаются отдельно через Telegram.
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {!createdEventId && (
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!canSubmit || isSubmitting}
                            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? 'Создание…' : 'Создать событие'}
                        </button>
                    )}
                    {error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100">
                            <div className="font-semibold">Ошибка</div>
                            <div className="mt-1 whitespace-pre-wrap">{error}</div>
                        </div>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 text-xs text-slate-500 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400">
                    Workspace: {workspaceId}
                </div>
            </div>
        </div>
    );
}
