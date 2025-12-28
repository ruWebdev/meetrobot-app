import { Module, Global } from '@nestjs/common';
import { AuthContext } from './auth.context';

@Global()
@Module({
    providers: [AuthContext],
    exports: [AuthContext],
})
export class AuthModule { }
