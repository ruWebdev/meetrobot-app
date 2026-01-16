import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubEventDto {
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    date!: string;

    @IsString()
    @IsNotEmpty()
    timeStart!: string;

    @IsString()
    @IsNotEmpty()
    timeEnd!: string;

    @IsString()
    @IsNotEmpty()
    location!: string;
}

export class CreateEventDto {
    @IsUUID()
    workspaceId!: string;

    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    @IsNotEmpty()
    date!: string;

    @IsString()
    @IsNotEmpty()
    timeStart!: string;

    @IsString()
    @IsNotEmpty()
    timeEnd!: string;

    @IsString()
    @IsNotEmpty()
    location!: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSubEventDto)
    subEvents?: CreateSubEventDto[];
}
