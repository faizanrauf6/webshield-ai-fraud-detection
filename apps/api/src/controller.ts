import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import type { Fixture } from '@webshield/core';
import { ScanService } from './service';
export class CreateScanDto {
  @IsString() @MaxLength(4096) url!: string;
  @IsOptional() @IsIn(['benign', 'phishing', 'investment']) fixture?: Fixture;
}
@Controller('api/v1')
export class ApiController {
  constructor(@Inject(ScanService) private readonly scans: ScanService) {}
  @Get('health') health() {
    return this.scans.health();
  }
  @Get('model-info') modelInfo() {
    return this.scans.modelInfo();
  }
  @Get('providers') providers() {
    return this.scans.providerStatus();
  }
  @Post('scans')
  @HttpCode(202)
  create(
    @Body(
      new ValidationPipe({
        expectedType: CreateScanDto,
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    body: CreateScanDto,
  ) {
    return this.scans.create(body.url, body.fixture);
  }
  @Get('scans') list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.scans.list(limit, cursor);
  }
  @Get('scans/:id/export')
  async export(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const report = await this.scans.get(id);
    response.setHeader('Content-Disposition', `attachment; filename="webshield-${id}.json"`);
    response.setHeader('Cache-Control', 'no-store');
    return report;
  }
  @Get('scans/:id') get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.scans.get(id);
  }
}
