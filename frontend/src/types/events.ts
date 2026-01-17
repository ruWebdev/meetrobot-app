export type EventStatus = 'draft' | 'scheduled' | 'cancelled' | 'completed';

export type EventParticipant = {
    userId: string;
    role: 'organizer' | 'participant';
    participationStatus: 'invited' | 'confirmed' | 'declined' | 'tentative';
    invitedAt: string;
    respondedAt: string | null;
    user: {
        firstName: string | null;
        lastName: string | null;
        username: string | null;
    } | null;
};

export type EventDetails = {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    startAt: string;
    endAt: string;
    status: EventStatus;
    createdById: string;
    createdAt: string;
    participants: EventParticipant[];
};

export type CreateEventPayload = {
    workspaceId: string;
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
};
