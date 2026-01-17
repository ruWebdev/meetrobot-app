import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEventDto {
    @IsUUID()
    workspaceId!: string;

    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsDateString()
    startAt!: string;

    @IsDateString()
    endAt!: string;
}
