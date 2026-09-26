import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

const valid = {
  email: '  An.Nguyen@Mail.COM ',
  password: 'matkhau123',
  fullName: '  Nguyễn An ',
  phone: '0912345678',
};

describe('registerSchema', () => {
  it('trims and lowercases the email, trims the name', () => {
    const out = registerSchema.parse(valid);
    expect(out.email).toBe('an.nguyen@mail.com');
    expect(out.fullName).toBe('Nguyễn An');
  });

  it('rejects a password shorter than 8 characters on the password field', () => {
    const r = registerSchema.safeParse({ ...valid, password: 'short' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['password']);
    expect(r.error?.issues[0]?.message).toBe('Mật khẩu tối thiểu 8 ký tự');
  });

  it.each(['912345678', '09123456789', '+84912345678', '09a2345678'])(
    'rejects phone %s',
    (phone) => {
      expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );

  it('rejects a blank full name', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
  });

  it('rejects an invalid email with a Vietnamese message', () => {
    const r = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(r.error?.issues[0]?.message).toBe('Email không hợp lệ');
  });
});

describe('loginSchema', () => {
  it('normalizes the email the same way as registration', () => {
    expect(loginSchema.parse({ email: ' A@B.VN', password: 'x' }).email).toBe('a@b.vn');
  });

  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.vn', password: '' }).success).toBe(false);
  });
});
