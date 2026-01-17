export type EventType = 'single' | 'parent' | 'service';

export type EventSlotPayload = {
    startTime: string;
    endTime: string;
    maxParticipants?: number;
};

export type CreateEventPayload = {
    type: EventType;
    title: string;
    description?: string;
    date?: string; // ISO 8601
    time?: string;
    location?: string;
    maxParticipants?: number;
    mandatoryAttendance?: boolean;
    slots?: EventSlotPayload[];
    confirmationMode?: 'auto' | 'manual';
};

export type CreateEventResponse = {
    id: string;
    workspaceId: string;
    type: EventType;
    title: string;
    status: 'draft' | 'published' | 'completed' | string;
    createdAt: string;
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
