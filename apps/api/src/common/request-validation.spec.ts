import { BadRequestException } from '@nestjs/common';
import {
  asRequestBody,
  optionalUuid,
  requiredString,
  requiredVersion,
} from './request-validation.js';

describe('request validation', () => {
  it('accepts only object bodies', () => {
    expect(asRequestBody({ title: 'Vase' })).toEqual({ title: 'Vase' });
    expect(() => asRequestBody(null)).toThrow(BadRequestException);
    expect(() => asRequestBody([])).toThrow(BadRequestException);
  });

  it('trims bounded required text', () => {
    expect(requiredString({ title: '  Vase  ' }, 'title', 1, 20)).toBe('Vase');
    expect(() => requiredString({ title: ' ' }, 'title', 1, 20)).toThrow(
      BadRequestException,
    );
    expect(() =>
      requiredString({ title: 'x'.repeat(21) }, 'title', 1, 20),
    ).toThrow(BadRequestException);
  });

  it('validates optimistic-lock versions and nullable UUIDs', () => {
    expect(requiredVersion({ expectedVersion: 3 })).toBe(3);
    expect(optionalUuid({ parentId: null }, 'parentId')).toBeNull();
    expect(() => requiredVersion({ expectedVersion: '3' })).toThrow(
      BadRequestException,
    );
    expect(() => optionalUuid({ parentId: 'invalid' }, 'parentId')).toThrow(
      BadRequestException,
    );
  });
});
