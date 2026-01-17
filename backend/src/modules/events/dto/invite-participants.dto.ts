import { IsArray, IsUUID } from 'class-validator';

export class InviteParticipantsDto {
    @IsArray()
    @IsUUID('all', { each: true })
    participantIds!: string[];
}
