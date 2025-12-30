import React, { useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { createEvent, ApiError } from '../api/events.api';
import { CreateEventPayload } from '../types/events';
import { SubEventForm, SubEventFormValue } from '../components/SubEventForm';

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
    if (status === 403) return 'Только владелец рабочего пространства может создавать события';
    if (status === 404) return 'Рабочее пространство не найдено';
    if (status >= 500) return 'Непредвиденная ошибка';
    return backendMessage || `Ошибка ${status}`;
}

export default function CreateEventPage(props: { workspaceId: string }) {
    const { workspaceId } = props;

    const userId = useMemo(() => getUserId(), []);
    const apiBaseUrl = useMemo(() => getQueryParam('apiBaseUrl') ?? 'http://localhost:3000', []);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    const [location, setLocation] = useState('');

    const [subEvents, setSubEvents] = useState<SubEventFormValue[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            WebApp.ready();
            WebApp.expand();
        } catch {
            // ignore (например, вне Telegram)
        }
    }, []);

    const canSubmit = Boolean(
        workspaceId &&
        userId &&
        title.trim() &&
        date &&
        timeStart &&
        timeEnd &&
        location.trim(),
    );

    const addSubEvent = () => {
        setSubEvents((prev) => [
            ...prev,
            { title: '', date: '', timeStart: '', timeEnd: '', location: '' },
        ]);
    };

    const updateSubEvent = (index: number, patch: Partial<SubEventFormValue>) => {
        setSubEvents((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    };

    const removeSubEvent = (index: number) => {
        setSubEvents((prev) => prev.filter((_, i) => i !== index));
    };

    const submit = async () => {
        setError(null);

        const payload: CreateEventPayload = {
            workspaceId,
            title: title.trim(),
            description: description.trim() ? description.trim() : undefined,
            date,
            timeStart,
            timeEnd,
            location: location.trim(),
            subEvents: subEvents.length
                ? subEvents.map((s) => ({
                    title: s.title,
                    date: s.date,
                    timeStart: s.timeStart,
                    timeEnd: s.timeEnd,
                    location: s.location,
                }))
                : undefined,
        };

        setIsSubmitting(true);
        try {
            const result = await createEvent({ apiBaseUrl, userId, payload });
            alert('Событие успешно создано');
            window.location.href = `/workspaces/${workspaceId}/events/${result.masterEvent.id}`;
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
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="mx-auto max-w-2xl p-4 pb-10">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold">Создание события</h1>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Заполните форму и нажмите «Создать событие».
                    </div>
                </div>


                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-base font-semibold">Основное событие</h2>

                    <div className="mt-4 grid gap-4">
                        <label className="grid gap-2">
                            <div className="text-sm font-medium">Название <span className="text-rose-500">*</span></div>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Например: Общее собрание"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                            />
                        </label>

                        <label className="grid gap-2">
                            <div className="text-sm font-medium">Описание</div>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Опционально"
                                className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                            />
                        </label>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Дата <span className="text-rose-500">*</span></div>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>

                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Место <span className="text-rose-500">*</span></div>
                                <input
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Например: офис, переговорная"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>

                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Время начала <span className="text-rose-500">*</span></div>
                                <input
                                    type="time"
                                    value={timeStart}
                                    onChange={(e) => setTimeStart(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>

                            <label className="grid gap-2">
                                <div className="text-sm font-medium">Время окончания <span className="text-rose-500">*</span></div>
                                <input
                                    type="time"
                                    value={timeEnd}
                                    onChange={(e) => setTimeEnd(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:focus:border-slate-600"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-base font-semibold">Под-события</h2>
                        <button
                            type="button"
                            onClick={addSubEvent}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                        >
                            Добавить под-событие
                        </button>
                    </div>

                    {subEvents.length === 0 ? (
                        <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">Под-события не добавлены.</div>
                    ) : null}

                    <div className="mt-4">
                        {subEvents.map((s, idx) => (
                            <SubEventForm
                                key={idx}
                                index={idx}
                                value={s}
                                onChange={(patch) => updateSubEvent(idx, patch)}
                                onRemove={() => removeSubEvent(idx)}
                            />
                        ))}
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit || isSubmitting}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? 'Создание…' : 'Создать событие'}
                    </button>
                </div>

                {error ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100">
                        <div className="font-semibold">Ошибка</div>
                        <div className="mt-1 whitespace-pre-wrap">{error}</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
