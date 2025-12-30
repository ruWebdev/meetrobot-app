import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateEventDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    date?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    timeStart?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    timeEnd?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    location?: string;
}
