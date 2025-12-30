import React from 'react';

export type SubEventFormValue = {
    title: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    location: string;
};

export function SubEventForm(props: {
    index: number;
    value: SubEventFormValue;
    onChange: (patch: Partial<SubEventFormValue>) => void;
    onRemove: () => void;
}) {
    const { index, value, onChange, onRemove } = props;

    return (
        <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong>Под-событие #{index + 1}</strong>
                <button type="button" onClick={onRemove} style={{ padding: '6px 10px' }}>
                    Удалить
                </button>
            </div>

            <label style={{ display: 'block', marginBottom: 10 }}>
                <div>Название *</div>
                <input
                    value={value.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    style={{ width: '100%', padding: 8 }}
                />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'block' }}>
                    <div>Дата *</div>
                    <input
                        type="date"
                        value={value.date}
                        onChange={(e) => onChange({ date: e.target.value })}
                        style={{ width: '100%', padding: 8 }}
                    />
                </label>

                <label style={{ display: 'block' }}>
                    <div>Место *</div>
                    <input
                        value={value.location}
                        onChange={(e) => onChange({ location: e.target.value })}
                        style={{ width: '100%', padding: 8 }}
                    />
                </label>

                <label style={{ display: 'block' }}>
                    <div>Время начала *</div>
                    <input
                        type="time"
                        value={value.timeStart}
                        onChange={(e) => onChange({ timeStart: e.target.value })}
                        style={{ width: '100%', padding: 8 }}
                    />
                </label>

                <label style={{ display: 'block' }}>
                    <div>Время окончания *</div>
                    <input
                        type="time"
                        value={value.timeEnd}
                        onChange={(e) => onChange({ timeEnd: e.target.value })}
                        style={{ width: '100%', padding: 8 }}
                    />
                </label>
            </div>
        </div>
    );
}
