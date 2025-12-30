import { CreateEventPayload, CreateEventResponse } from '../types/events';

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
        return 'Unexpected error';
    }
}

export async function createEvent(params: {
    apiBaseUrl: string;
    userId: string;
    payload: CreateEventPayload;
}): Promise<CreateEventResponse> {
    const resp = await fetch(`${params.apiBaseUrl}/events`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-user-id': params.userId,
        },
        body: JSON.stringify(params.payload),
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

    return data as CreateEventResponse;
}
