import { FlowType } from './flow-type';

export interface UserSession {
    telegramUserId: string;
    telegramChatId: string;
    workspaceId: string;

    activeFlowType: FlowType | null;
    activeEntityId: string | null;

    eventDraft?: {
        workspaceId?: string;
        title?: string;
        description?: string | null;
        startAt?: string;
        endAt?: string;
    } | null;
    eventDraftStep?: 'title' | 'description' | 'startAt' | 'endAt' | 'confirm' | null;

    updatedAt: Date;
}
