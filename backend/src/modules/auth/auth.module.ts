import { Module, Global } from '@nestjs/common';
import { AuthContext } from './auth.context';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { ActiveWorkspaceGuard, UserGuard } from './auth.guard';

@Global()
@Module({
    imports: [PrismaModule],
    providers: [AuthContext, UserGuard, ActiveWorkspaceGuard],
    exports: [AuthContext, UserGuard, ActiveWorkspaceGuard],
})
export class AuthModule { }
