import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class AuthContext {
    userId?: string;
    workspaceId?: string;
    role?: string;
}
