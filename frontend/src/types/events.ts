export type CreateSubEventPayload = {
    title: string;
    date: string; // YYYY-MM-DD
    timeStart: string; // HH:mm
    timeEnd: string; // HH:mm
    location: string;
};

export type CreateEventPayload = {
    workspaceId: string;
    title: string;
    description?: string;
    date: string; // YYYY-MM-DD
    timeStart: string; // HH:mm
    timeEnd: string; // HH:mm
    location: string;
    subEvents?: CreateSubEventPayload[];
};

export type CreatedEvent = {
    id: string;
    workspaceId: string;
    parentEventId: string | null;
    type: 'master' | 'sub';
    title: string;
    description: string | null;
    date: string;
    timeStart: string;
    timeEnd: string;
    location: string;
    status: 'scheduled' | string;
    createdById: string;
    createdAt: string;
};

export type CreateEventResponse = {
    masterEvent: CreatedEvent;
    subEvents: CreatedEvent[];
};

export type EventForEditResponse = {
    masterEvent: {
        id: string;
        workspaceId: string;
        title: string;
        description: string | null;
        date: string;
        timeStart: string;
        timeEnd: string;
        location: string;
    };
    subEvents: Array<{
        id: string;
        title: string;
        date: string;
        timeStart: string;
        timeEnd: string;
        location: string;
    }>;
};

export type EditEventDto = {
    title?: string;
    description?: string;
    date?: string;
    timeStart?: string;
    timeEnd?: string;
    location?: string;
};
