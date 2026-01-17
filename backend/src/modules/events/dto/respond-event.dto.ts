import { IsIn } from 'class-validator';

export class RespondEventDto {
    @IsIn(['invited', 'confirmed', 'declined', 'tentative'])
    status!: 'invited' | 'confirmed' | 'declined' | 'tentative';
}
