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
    if (status === 401) return 'Unauthorized';
    if (status === 403) return 'Only workspace owner can create events';
    if (status === 404) return 'Workspace not found';
    if (status >= 500) return 'Unexpected error';
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
            alert('Event created successfully');
            window.location.href = `/workspaces/${workspaceId}/events/${result.masterEvent.id}`;
        } catch (e: any) {
            const apiError = e as ApiError;
            if (typeof apiError?.status === 'number') {
                setError(errorMessageByStatus(apiError.status, apiError.message));
                return;
            }

            setError('Unexpected error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
            <h1 style={{ marginTop: 0 }}>Создание события</h1>

            <div style={{ marginBottom: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
                <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Workspace</div>
                    <div style={{ wordBreak: 'break-all' }}>{workspaceId}</div>
                </div>
                <div>
                    <div style={{ fontSize: 12, color: '#666' }}>Пользователь (x-user-id)</div>
                    <div style={{ wordBreak: 'break-all' }}>{userId || '—'}</div>
                </div>
            </div>

            <h2>Основное событие</h2>

            <label style={{ display: 'block', marginBottom: 10 }}>
                <div>Название *</div>
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: 8 }} />
            </label>

            <label style={{ display: 'block', marginBottom: 10 }}>
                <div>Описание</div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: 8, minHeight: 80 }} />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'block' }}>
                    <div>Дата *</div>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: 8 }} />
                </label>

                <label style={{ display: 'block' }}>
                    <div>Место *</div>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: '100%', padding: 8 }} />
                </label>

                <label style={{ display: 'block' }}>
                    <div>Время начала *</div>
                    <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} style={{ width: '100%', padding: 8 }} />
                </label>

                <label style={{ display: 'block' }}>
                    <div>Время окончания *</div>
                    <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} style={{ width: '100%', padding: 8 }} />
                </label>
            </div>

            <h2 style={{ marginTop: 18 }}>Под-события</h2>

            <button type="button" onClick={addSubEvent} style={{ padding: '8px 12px', marginBottom: 12 }}>
                Add sub-event
            </button>

            {subEvents.length === 0 ? (
                <div style={{ color: '#666', marginBottom: 12 }}>Под-события не добавлены.</div>
            ) : null}

            {subEvents.map((s, idx) => (
                <SubEventForm
                    key={idx}
                    index={idx}
                    value={s}
                    onChange={(patch) => updateSubEvent(idx, patch)}
                    onRemove={() => removeSubEvent(idx)}
                />
            ))}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="button" onClick={submit} disabled={!canSubmit || isSubmitting} style={{ padding: '10px 14px' }}>
                    {isSubmitting ? 'Создание…' : 'Create Event'}
                </button>
                <div style={{ color: '#666', fontSize: 12 }}>API: {apiBaseUrl}</div>
            </div>

            {error ? (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid #f2b8b5', background: '#fff5f5', borderRadius: 8 }}>
                    <strong>Ошибка:</strong> {error}
                </div>
            ) : null}
        </div>
    );
}
