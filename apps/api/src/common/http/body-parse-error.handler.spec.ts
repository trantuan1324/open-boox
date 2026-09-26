import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { bodyParseErrorHandler } from './body-parse-error.handler';

function fakeRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

describe('bodyParseErrorHandler', () => {
  afterEach(() => jest.restoreAllMocks());

  it('answers malformed JSON with 400 and does not log', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const res = fakeRes();
    bodyParseErrorHandler({ type: 'entity.parse.failed' }, {} as Request, res as unknown as Response, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs unexpected errors that become a 500', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const res = fakeRes();
    bodyParseErrorHandler(new Error('disk on fire'), {} as Request, res as unknown as Response, jest.fn());
    expect(res.statusCode).toBe(500);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('disk on fire'));
  });
});
