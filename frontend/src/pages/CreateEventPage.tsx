import React, { useEffect, useMemo, useState } from 'react';
import WebApp from '@twa-dev/sdk';
import { ApiError, createWorkspaceEvent } from '../api/events.api';
import { CreateEventPayload, EventSlotPayload, EventType } from '../types/events';

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

export default function CreateEventPage(props: { workspaceId: string }) {
    const { workspaceId } = props;

    const userId = useMemo(() => getUserId(), []);
    const apiBaseUrl = useMemo(() => getQueryParam('apiBaseUrl') ?? 'http://localhost:3000', []);
    const querySuffix = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        const value = params.toString();
        return value ? `?${value}` : '';
    }, []);

    const [selectedType, setSelectedType] = useState<EventType | null>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [maxParticipants, setMaxParticipants] = useState('');
    const [mandatoryAttendance, setMandatoryAttendance] = useState(false);
    const [confirmationMode, setConfirmationMode] = useState<'auto' | 'manual'>('auto');

    const [slots, setSlots] = useState<Array<EventSlotPayload & { id: string }>>([]);
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

    const canSubmit = Boolean(
        workspaceId &&
        userId &&
        selectedType &&
        title.trim() &&
        ((selectedType === 'single' || selectedType === 'parent') ? date : true) &&
        (selectedType !== 'service' || slots.length > 0),
    );

    const addSlot = () => {
        setSlots((prev) => [
            ...prev,
            { id: crypto.randomUUID(), startTime: '', endTime: '', maxParticipants: undefined },
        ]);
    };

    const updateSlot = (id: string, patch: Partial<EventSlotPayload>) => {
        setSlots((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)));
    };

    const removeSlot = (id: string) => {
        setSlots((prev) => prev.filter((slot) => slot.id !== id));
    };

    const submit = async () => {
        setError(null);

        if (!selectedType) {
            setError('Выберите тип события');
            return;
        }

        const payload: CreateEventPayload = {
            type: selectedType,
            title: title.trim(),
            description: description.trim() ? description.trim() : undefined,
            date: date || undefined,
            time: time || undefined,
            location: location.trim() ? location.trim() : undefined,
            maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
            mandatoryAttendance: selectedType === 'parent' ? mandatoryAttendance : undefined,
            slots: selectedType === 'service'
                ? slots.map(({ id, ...slot }) => ({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    maxParticipants: slot.maxParticipants ? Number(slot.maxParticipants) : undefined,
                }))
                : undefined,
            confirmationMode: selectedType === 'service' ? confirmationMode : undefined,
        };

        setIsSubmitting(true);
        try {
            const result = await createWorkspaceEvent({ apiBaseUrl, userId, workspaceId, payload });
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
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 text-slate-900">
            <div className="mx-auto max-w-3xl p-4 pb-12">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Создание события</h1>
                        <div className="mt-1 text-sm text-slate-600">
                            Выберите тип события и заполните нужные поля.
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => (window.location.href = `/workspaces/${workspaceId}${querySuffix}`)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                        Вернуться в Workspace
                    </button>
                </div>

                {createdEventId ? (
                    <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
                        <div className="text-sm font-semibold text-emerald-700">Событие создано</div>
                        <div className="mt-2 text-lg font-semibold">ID события</div>
                        <div className="mt-1 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{createdEventId}</div>
                        <div className="mt-4 text-sm text-slate-600">
                            Вы можете продолжить работу с событием в списке событий Workspace.
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-3">
                            {[
                                {
                                    type: 'single' as const,
                                    title: 'Единичное событие',
                                    hint: 'Одно событие без вложенной структуры.',
                                },
                                {
                                    type: 'parent' as const,
                                    title: 'Событие с подсобытиями',
                                    hint: 'Группа связанных событий с опцией обязательного участия.',
                                },
                                {
                                    type: 'service' as const,
                                    title: 'Запись на услугу',
                                    hint: 'Запись по слотам с подтверждением и лимитами.',
                                },
                            ].map((item) => (
                                <button
                                    key={item.type}
                                    type="button"
                                    onClick={() => setSelectedType(item.type)}
                                    className={`group rounded-2xl border p-4 text-left shadow-sm transition ${
                                        selectedType === item.type
                                            ? 'border-emerald-400 bg-emerald-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <div className="text-base font-semibold text-slate-900">{item.title}</div>
                                    <div className="mt-2 text-sm text-slate-600">{item.hint}</div>
                                </button>
                            ))}
                        </div>

                        {selectedType && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="text-sm font-semibold text-slate-500">Тип: {selectedType}</div>
                                <div className="mt-4 grid gap-4">
                                    <label className="grid gap-2">
                                        <div className="text-sm font-medium">Название <span className="text-rose-500">*</span></div>
                                        <input
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Например: Презентация продукта"
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                        />
                                    </label>

                                    <label className="grid gap-2">
                                        <div className="text-sm font-medium">Описание</div>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Опишите цель или формат события"
                                            className="min-h-[96px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                        />
                                    </label>

                                    {(selectedType === 'single' || selectedType === 'parent') && (
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <label className="grid gap-2">
                                                <div className="text-sm font-medium">Дата <span className="text-rose-500">*</span></div>
                                                <input
                                                    type="date"
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                                />
                                            </label>

                                            <label className="grid gap-2">
                                                <div className="text-sm font-medium">Время</div>
                                                <input
                                                    type="time"
                                                    value={time}
                                                    onChange={(e) => setTime(e.target.value)}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                                />
                                            </label>

                                            <label className="grid gap-2">
                                                <div className="text-sm font-medium">Место</div>
                                                <input
                                                    value={location}
                                                    onChange={(e) => setLocation(e.target.value)}
                                                    placeholder="Офис, переговорная, онлайн"
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                                />
                                            </label>

                                            {selectedType === 'single' && (
                                                <label className="grid gap-2">
                                                    <div className="text-sm font-medium">Максимум участников</div>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={maxParticipants}
                                                        onChange={(e) => setMaxParticipants(e.target.value)}
                                                        placeholder="Например: 20"
                                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                                    />
                                                </label>
                                            )}

                                            {selectedType === 'parent' && (
                                                <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={mandatoryAttendance}
                                                        onChange={(e) => setMandatoryAttendance(e.target.checked)}
                                                        className="h-4 w-4 accent-emerald-500"
                                                    />
                                                    Обязательное посещение всех подсобытий
                                                </label>
                                            )}
                                        </div>
                                    )}

                                    {selectedType === 'service' && (
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold">Слоты для записи</div>
                                                    <div className="text-xs text-slate-500">Добавьте минимум один слот.</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={addSlot}
                                                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                                                >
                                                    Добавить слот
                                                </button>
                                            </div>

                                            {slots.length === 0 && (
                                                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                                                    Слоты пока не добавлены.
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {slots.map((slot, index) => (
                                                    <div key={slot.id} className="rounded-xl border border-slate-200 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-sm font-semibold">Слот #{index + 1}</div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeSlot(slot.id)}
                                                                className="text-xs text-rose-500 hover:text-rose-600"
                                                            >
                                                                Удалить
                                                            </button>
                                                        </div>
                                                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                                                            <label className="grid gap-2">
                                                                <div className="text-xs font-medium text-slate-500">Начало</div>
                                                                <input
                                                                    type="datetime-local"
                                                                    value={slot.startTime}
                                                                    onChange={(e) => updateSlot(slot.id, { startTime: e.target.value })}
                                                                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-emerald-400"
                                                                />
                                                            </label>
                                                            <label className="grid gap-2">
                                                                <div className="text-xs font-medium text-slate-500">Окончание</div>
                                                                <input
                                                                    type="datetime-local"
                                                                    value={slot.endTime}
                                                                    onChange={(e) => updateSlot(slot.id, { endTime: e.target.value })}
                                                                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-emerald-400"
                                                                />
                                                            </label>
                                                            <label className="grid gap-2">
                                                                <div className="text-xs font-medium text-slate-500">Лимит участников</div>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={slot.maxParticipants ?? ''}
                                                                    onChange={(e) => updateSlot(slot.id, { maxParticipants: e.target.value ? Number(e.target.value) : undefined })}
                                                                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-emerald-400"
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <label className="grid gap-2">
                                                <div className="text-sm font-medium">Подтверждение записи</div>
                                                <select
                                                    value={confirmationMode}
                                                    onChange={(e) => setConfirmationMode(e.target.value as 'auto' | 'manual')}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                                                >
                                                    <option value="auto">Автоматическое</option>
                                                    <option value="manual">Ручное</option>
                                                </select>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!canSubmit || isSubmitting}
                                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isSubmitting ? 'Создание…' : 'Создать событие'}
                            </button>
                            {error ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                                    <div className="font-semibold">Ошибка</div>
                                    <div className="mt-1 whitespace-pre-wrap">{error}</div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
