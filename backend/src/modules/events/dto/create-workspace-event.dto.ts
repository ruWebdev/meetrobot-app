import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEventSlotDto {
    @IsString()
    @IsNotEmpty()
    startTime!: string;

    @IsString()
    @IsNotEmpty()
    endTime!: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    maxParticipants?: number;
}

export class CreateWorkspaceEventDto {
    @IsIn(['single', 'parent', 'service'])
    type!: 'single' | 'parent' | 'service';

    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    date?: string;

    @IsOptional()
    @IsString()
    time?: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    maxParticipants?: number;

    @IsOptional()
    mandatoryAttendance?: boolean;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEventSlotDto)
    slots?: CreateEventSlotDto[];

    @IsOptional()
    @IsIn(['auto', 'manual'])
    confirmationMode?: 'auto' | 'manual';
}
