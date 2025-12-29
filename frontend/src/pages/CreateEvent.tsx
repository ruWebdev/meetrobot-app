import React, { useMemo, useState } from 'react';

type SubEventForm = {
    title: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    location: string;
};

function getQueryParam(name: string): string | null {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

export default function CreateEventPage() {
    const workspaceId = useMemo(() => getQueryParam('workspaceId') ?? '', []);
    const userId = useMemo(() => getQueryParam('userId') ?? '', []);
    const apiBaseUrl = useMemo(() => getQueryParam('apiBaseUrl') ?? '', []);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState('');
    const [timeStart, setTimeStart] = useState('');
    const [timeEnd, setTimeEnd] = useState('');
    const [location, setLocation] = useState('');

    const [subEvents, setSubEvents] = useState<SubEventForm[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const effectiveApiBaseUrl = apiBaseUrl || 'http://localhost:3000';

    const addSubEvent = () => {
        setSubEvents((prev) => [
            ...prev,
            { title: '', date: '', timeStart: '', timeEnd: '', location: '' },
        ]);
    };

    const updateSubEvent = (index: number, patch: Partial<SubEventForm>) => {
        setSubEvents((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    };

    const removeSubEvent = (index: number) => {
        setSubEvents((prev) => prev.filter((_, i) => i !== index));
    };

    const submit = async () => {
        setError(null);
        setResult(null);

        if (!workspaceId) {
            setError('Не указан workspaceId. Откройте Web App с параметром ?workspaceId=<UUID>.');
            return;
        }
        if (!userId) {
            setError('Не указан userId. Откройте Web App с параметром ?userId=<UUID>.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: any = {
                workspaceId,
                title,
                description: description || undefined,
                date,
                timeStart,
                timeEnd,
                location,
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

            const resp = await fetch(`${effectiveApiBaseUrl}/events`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-user-id': userId,
                },
                body: JSON.stringify(payload),
            });

            const text = await resp.text();
            let data: any = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = { raw: text };
            }

            if (!resp.ok) {
                const message = (data && (data.message || data.error)) || `Ошибка ${resp.status}`;
                setError(typeof message === 'string' ? message : JSON.stringify(message));
                return;
            }

            setResult(data);
        } catch (e: any) {
            setError(e?.message ?? 'Не удалось создать событие');
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
                    <div style={{ wordBreak: 'break-all' }}>{workspaceId || '—'}</div>
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
                Добавить под-событие
            </button>

            {subEvents.length === 0 ? (
                <div style={{ color: '#666', marginBottom: 12 }}>Под-события не добавлены.</div>
            ) : null}

            {subEvents.map((s, idx) => (
                <div key={idx} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <strong>Под-событие #{idx + 1}</strong>
                        <button type="button" onClick={() => removeSubEvent(idx)} style={{ padding: '6px 10px' }}>
                            Удалить
                        </button>
                    </div>

                    <label style={{ display: 'block', marginBottom: 10 }}>
                        <div>Название *</div>
                        <input value={s.title} onChange={(e) => updateSubEvent(idx, { title: e.target.value })} style={{ width: '100%', padding: 8 }} />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={{ display: 'block' }}>
                            <div>Дата *</div>
                            <input type="date" value={s.date} onChange={(e) => updateSubEvent(idx, { date: e.target.value })} style={{ width: '100%', padding: 8 }} />
                        </label>

                        <label style={{ display: 'block' }}>
                            <div>Место *</div>
                            <input value={s.location} onChange={(e) => updateSubEvent(idx, { location: e.target.value })} style={{ width: '100%', padding: 8 }} />
                        </label>

                        <label style={{ display: 'block' }}>
                            <div>Время начала *</div>
                            <input type="time" value={s.timeStart} onChange={(e) => updateSubEvent(idx, { timeStart: e.target.value })} style={{ width: '100%', padding: 8 }} />
                        </label>

                        <label style={{ display: 'block' }}>
                            <div>Время окончания *</div>
                            <input type="time" value={s.timeEnd} onChange={(e) => updateSubEvent(idx, { timeEnd: e.target.value })} style={{ width: '100%', padding: 8 }} />
                        </label>
                    </div>
                </div>
            ))}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button type="button" onClick={submit} disabled={isSubmitting} style={{ padding: '10px 14px' }}>
                    {isSubmitting ? 'Создание…' : 'Создать событие'}
                </button>
                <div style={{ color: '#666', fontSize: 12 }}>
                    API: {effectiveApiBaseUrl}
                </div>
            </div>

            {error ? (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid #f2b8b5', background: '#fff5f5', borderRadius: 8 }}>
                    <strong>Ошибка:</strong> {error}
                </div>
            ) : null}

            {result ? (
                <div style={{ marginTop: 12, padding: 12, border: '1px solid #c8e6c9', background: '#f3fff4', borderRadius: 8 }}>
                    <strong>Успех.</strong>
                    <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
                </div>
            ) : null}

            <div style={{ marginTop: 18, fontSize: 12, color: '#666' }}>
                Открывайте экран с параметрами: <code>?workspaceId=&lt;UUID&gt;&amp;userId=&lt;UUID&gt;</code>
                {apiBaseUrl ? null : (
                    <>
                        {' '}
                        (опционально <code>&amp;apiBaseUrl=http://localhost:3000</code>).
                    </>
                )}
            </div>
        </div>
    );
}
