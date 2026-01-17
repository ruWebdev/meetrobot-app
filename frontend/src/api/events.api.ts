import { CreateEventPayload, EventDetails } from '../types/events';

export type ApiError = {
    status: number;
    message: string;
};

function normalizeErrorMessage(data: any): string {
    const msg = data?.message ?? data?.error ?? data;

    if (Array.isArray(msg)) {
        return msg.join('\n');
    }

    if (typeof msg === 'string') {
        return msg;
    }

    try {
        return JSON.stringify(msg);
    } catch {
        return 'Неожиданная ошибка';
    }
}

async function request<T>(params: {
    apiBaseUrl: string;
    userId: string;
    path: string;
    method?: string;
    body?: any;
}): Promise<T> {
    const resp = await fetch(`${params.apiBaseUrl}${params.path}`, {
        method: params.method ?? 'GET',
        headers: {
            'content-type': 'application/json',
            'x-user-id': params.userId,
        },
        body: params.body ? JSON.stringify(params.body) : undefined,
    });

    const text = await resp.text();
    let data: any = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }

    if (!resp.ok) {
        throw {
            status: resp.status,
            message: normalizeErrorMessage(data),
        } satisfies ApiError;
    }

    return data as T;
}

export async function createEvent(params: {
    apiBaseUrl: string;
    userId: string;
    payload: CreateEventPayload;
}): Promise<EventDetails> {
    return request<EventDetails>({
        apiBaseUrl: params.apiBaseUrl,
        userId: params.userId,
        path: '/events',
        method: 'POST',
        body: params.payload,
    });
}

export async function getEventDetails(params: {
    apiBaseUrl: string;
    userId: string;
    eventId: string;
}): Promise<EventDetails> {
    return request<EventDetails>({
        apiBaseUrl: params.apiBaseUrl,
        userId: params.userId,
        path: `/events/${params.eventId}`,
    });
}
