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
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Под-событие #{index + 1}</div>
                <button
                    type="button"
                    onClick={onRemove}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                    Удалить
                </button>
            </div>

            <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                    <div className="text-sm font-medium">Название <span className="text-rose-500">*</span></div>
                    <input
                        value={value.title}
                        onChange={(e) => onChange({ title: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600"
                    />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                        <div className="text-sm font-medium">Дата <span className="text-rose-500">*</span></div>
                        <input
                            type="date"
                            value={value.date}
                            onChange={(e) => onChange({ date: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600"
                        />
                    </label>

                    <label className="grid gap-2">
                        <div className="text-sm font-medium">Место <span className="text-rose-500">*</span></div>
                        <input
                            value={value.location}
                            onChange={(e) => onChange({ location: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600"
                        />
                    </label>

                    <label className="grid gap-2">
                        <div className="text-sm font-medium">Время начала <span className="text-rose-500">*</span></div>
                        <input
                            type="time"
                            value={value.timeStart}
                            onChange={(e) => onChange({ timeStart: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600"
                        />
                    </label>

                    <label className="grid gap-2">
                        <div className="text-sm font-medium">Время окончания <span className="text-rose-500">*</span></div>
                        <input
                            type="time"
                            value={value.timeEnd}
                            onChange={(e) => onChange({ timeEnd: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:focus:border-slate-600"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
}
