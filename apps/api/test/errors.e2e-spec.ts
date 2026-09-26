import { Body, Controller, Get, Post } from '@nestjs/common';
import request from 'supertest';
import { z } from 'zod';
import { Public } from '../src/auth/decorators/public.decorator';
import { DomainError } from '../src/common/errors/domain-error';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, type TestContext } from './test-app';

const echoSchema = z.object({ name: z.string().min(1, 'Bắt buộc') });

@Public()
@Controller('test-errors')
class ErrorsTestController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('echo')
  echo(@Body(new ZodValidationPipe(echoSchema)) body: z.output<typeof echoSchema>) {
    return body;
  }

  @Get('domain')
  domain(): never {
    throw new DomainError('OUT_OF_STOCK', 'Hết hàng');
  }

  @Get('missing')
  async missing(): Promise<void> {
    await this.prisma.user.update({ where: { id: 'does-not-exist' }, data: { fullName: 'x' } });
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internals');
  }
}

describe('error pipeline', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [ErrorsTestController] });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('accepts valid JSON', async () => {
    await request(ctx.http).post('/api/test-errors/echo').send({ name: 'An' }).expect(201, { name: 'An' });
  });

  it('accepts application/json with a charset parameter', async () => {
    await request(ctx.http)
      .post('/api/test-errors/echo')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(JSON.stringify({ name: 'An' }))
      .expect(201, { name: 'An' });
  });

  it('returns field errors for schema violations', async () => {
    const res = await request(ctx.http).post('/api/test-errors/echo').send({ name: '' }).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', fields: { name: 'Bắt buộc' } });
  });

  it('rejects non-JSON content types with 415', async () => {
    const res = await request(ctx.http)
      .post('/api/test-errors/echo')
      .set('Content-Type', 'text/plain')
      .send('name=An')
      .expect(415);
    expect(res.body).toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('rejects a POST with no content type with 415', async () => {
    const res = await request(ctx.http).post('/api/test-errors/echo').expect(415);
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('turns malformed JSON into a 400 JSON error', async () => {
    const res = await request(ctx.http)
      .post('/api/test-errors/echo')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('maps domain errors', async () => {
    const res = await request(ctx.http).get('/api/test-errors/domain').expect(409);
    expect(res.body).toEqual({ statusCode: 409, code: 'OUT_OF_STOCK', message: 'Hết hàng' });
  });

  it('maps Prisma record-not-found to 404', async () => {
    const res = await request(ctx.http).get('/api/test-errors/missing').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('hides internals on unexpected errors', async () => {
    const res = await request(ctx.http).get('/api/test-errors/boom').expect(500);
    expect(res.body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(ctx.http).get('/api/does-not-exist').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
