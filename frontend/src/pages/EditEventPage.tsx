import React, { useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';

import { ApiError, deleteEvent, getEventForEdit, updateEvent } from '../api/events.api';
import { EditEventDto, EventForEditResponse } from '../types/events';

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

function isoToDateInput(iso: string): string {
    // ожидаем YYYY-MM-DDTHH:mm:ss...
    if (!iso) return '';
    return iso.slice(0, 10);
}

function errorMessageByStatus(status: number, backendMessage: string): string {
    if (status === 400) return backendMessage || 'Некорректные данные';
    if (status === 401) return 'Нет авторизации';
    if (status === 403) return 'Доступ запрещён';
    if (status === 404) return 'Событие не найдено';
    if (status >= 500) return 'Непредвиденная ошибка';
    return backendMessage || `Ошибка ${status}`;
}

export default function EditEventPage(props: { workspaceId: string; eventId: string }) {
    const { workspaceId, eventId } = props;

    const userId = useMemo(() => getUserId(), []);
    const apiBaseUrl = useMemo(() => getQueryParam('apiBaseUrl') ?? 'http://localhost:3000', []);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [initial, setInitial] = useState<EventForEditResponse | null>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    const [location, setLocation] = useState('');

    useEffect(() => {
        try {
            WebApp.ready();
            WebApp.expand();
        } catch {
            // ignore
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getEventForEdit({ apiBaseUrl, userId, eventId });
                if (cancelled) return;

                setInitial(data);
                setTitle(data.masterEvent.title ?? '');
                setDescription(data.masterEvent.description ?? '');
                setDate(isoToDateInput(data.masterEvent.date));
                setTimeStart(data.masterEvent.timeStart ?? '');
                setTimeEnd(data.masterEvent.timeEnd ?? '');
                setLocation(data.masterEvent.location ?? '');
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
    }, [apiBaseUrl, eventId, userId]);

    const canSave = Boolean(!loading && initial && userId && title.trim() && date && timeStart && timeEnd && location.trim());

    const buildPatch = (): EditEventDto => {
        const patch: EditEventDto = {};
        if (!initial) return patch;

        const initialTitle = initial.masterEvent.title ?? '';
        const initialDescription = initial.masterEvent.description ?? '';
        const initialDate = isoToDateInput(initial.masterEvent.date);
        const initialTimeStart = initial.masterEvent.timeStart ?? '';
        const initialTimeEnd = initial.masterEvent.timeEnd ?? '';
        const initialLocation = initial.masterEvent.location ?? '';

        if (title.trim() !== initialTitle) patch.title = title.trim();
        if (description !== initialDescription) patch.description = description;
        if (date !== initialDate) patch.date = date;
        if (timeStart !== initialTimeStart) patch.timeStart = timeStart;
        if (timeEnd !== initialTimeEnd) patch.timeEnd = timeEnd;
        if (location.trim() !== initialLocation) patch.location = location.trim();

        return patch;
    };

    const onSave = async () => {
        if (!canSave) return;
        setError(null);

        const patch = buildPatch();
        if (Object.keys(patch).length === 0) {
            alert('Изменений нет');
            return;
        }

        setSaving(true);
        try {
            await updateEvent({ apiBaseUrl, userId, eventId, payload: patch });
            alert('Событие обновлено');
            try {
                WebApp.close();
            } catch {
                window.history.back();
            }
        } catch (e: any) {
            const apiError = e as ApiError;
            if (typeof apiError?.status === 'number') {
                setError(errorMessageByStatus(apiError.status, apiError.message));
            } else {
                setError('Непредвиденная ошибка');
            }
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async () => {
        if (!initial) return;

        const confirmed = window.confirm(
            'Вы уверены, что хотите удалить это событие?\n' +
            'Это действие нельзя отменить.',
        );

        if (!confirmed) return;

        setError(null);
        setDeleting(true);
        try {
            await deleteEvent({ apiBaseUrl, userId, eventId });
            alert('Событие удалено');
            try {
                WebApp.close();
            } catch {
                window.history.back();
            }
        } catch (e: any) {
            const apiError = e as ApiError;
            if (typeof apiError?.status === 'number') {
                setError(errorMessageByStatus(apiError.status, apiError.message));
            } else {
                setError('Непредвиденная ошибка');
            }
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="mx-auto max-w-2xl p-4 pb-10">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold">Редактирование события</h1>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Измените поля и нажмите «Сохранить изменения».
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                        Загрузка…
                    </div>
                ) : null}

                {error ? (
                    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100">
                        <div className="font-semibold">Ошибка</div>
                        <div className="mt-1 whitespace-pre-wrap">{error}</div>
                    </div>
                ) : null}

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-base font-semibold">Основное событие</h2>

                    <div className="mt-4 grid gap-4">
                        <label className="grid gap-2">
                            <div className="text-sm font-medium">Название <span className="text-rose-500">*</span></div>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={!initial || saving || deleting}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                            />
                        </label>

                        <label className="grid gap-2">
                            <div className="text-sm font-medium">Описание</div>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={!initial || saving || deleting}
                                className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                            />
                        </label>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Дата <span className="text-rose-500">*</span></div>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    disabled={!initial || saving || deleting}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>

                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Место <span className="text-rose-500">*</span></div>
                                <input
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    disabled={!initial || saving || deleting}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>

                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Время начала <span className="text-rose-500">*</span></div>
                                <input
                                    type="time"
                                    value={timeStart}
                                    onChange={(e) => setTimeStart(e.target.value)}
                                    disabled={!initial || saving || deleting}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>

                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Время окончания <span className="text-rose-500">*</span></div>
                                <input
                                    type="time"
                                    value={timeEnd}
                                    onChange={(e) => setTimeEnd(e.target.value)}
                                    disabled={!initial || saving || deleting}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-base font-semibold">Под-события</h2>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                        Под-события доступны только для просмотра на этом шаге.
                    </div>

                    {initial?.subEvents?.length ? (
                        <div className="mt-4 space-y-3">
                            {initial.subEvents.map((se) => (
                                <div key={se.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                    <div className="font-semibold">{se.title}</div>
                                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
                                        <div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Дата</div>
                                            <div className="font-mono">{isoToDateInput(se.date)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Время</div>
                                            <div className="font-mono">{se.timeStart}–{se.timeEnd}</div>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Место</div>
                                            <div className="font-mono">{se.location}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">Под-событий нет.</div>
                    )}
                </div>

                <div className="mt-4 grid gap-3">
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={!canSave || saving || deleting}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Сохранение…' : 'Сохранить изменения'}
                    </button>

                    <button
                        type="button"
                        onClick={onDelete}
                        disabled={!initial || saving || deleting}
                        className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/60"
                    >
                        {deleting ? 'Удаление…' : 'Удалить событие'}
                    </button>
                </div>

                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Workspace: {workspaceId}
                </div>
            </div>
        </div>
    );
}
