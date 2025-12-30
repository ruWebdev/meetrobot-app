import { FlowType } from './flow-type';

export interface UserSession {
    telegramUserId: string;
    telegramChatId: string;
    workspaceId: string;

    activeFlowType: FlowType | null;
    activeEntityId: string | null;

    updatedAt: Date;
}
