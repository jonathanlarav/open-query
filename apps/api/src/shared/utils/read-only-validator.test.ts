import { describe, it, expect } from 'vitest';
import { validateReadOnly } from './read-only-validator.js';
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

function expectBlocked(query: string, dbType?: string) {
  expect(() => validateReadOnly(query, dbType)).toThrow(AppError);
}

function expectAllowed(query: string, dbType?: string) {
  expect(() => validateReadOnly(query, dbType)).not.toThrow();
}

describe('validateReadOnly — SQL', () => {
  describe('SELECT passes', () => {
    it('simple SELECT', () => expectAllowed('SELECT * FROM users'));
    it('SELECT with subquery', () => expectAllowed('SELECT id FROM users WHERE id IN (SELECT id FROM admins)'));
    it('CTE', () => expectAllowed('WITH cte AS (SELECT 1 AS n) SELECT n FROM cte'));
    it('JOIN', () => expectAllowed('SELECT u.id, o.amount FROM users u JOIN orders o ON u.id = o.user_id'));
  });

  describe('write statements are blocked (keyword check)', () => {
    it('INSERT', () => expectBlocked('INSERT INTO users(name) VALUES("bob")'));
    it('UPDATE', () => expectBlocked('UPDATE users SET name="bob" WHERE id=1'));
    it('DELETE', () => expectBlocked('DELETE FROM users WHERE id=1'));
    it('DROP', () => expectBlocked('DROP TABLE users'));
    it('TRUNCATE', () => expectBlocked('TRUNCATE TABLE users'));
    it('ALTER', () => expectBlocked('ALTER TABLE users ADD COLUMN email TEXT'));
    it('CREATE', () => expectBlocked('CREATE TABLE foo (id INT)'));
    it('GRANT', () => expectBlocked('GRANT SELECT ON users TO bob'));
    it('EXEC', () => expectBlocked('EXEC sp_who'));
  });

  describe('case-insensitive blocking', () => {
    it('lowercase insert', () => expectBlocked('insert into users(name) values("bob")'));
    it('mixed case update', () => expectBlocked('uPdAtE users SET name="bob"'));
    it('lowercase delete', () => expectBlocked('delete from users where id=1'));
  });

  describe('AST parse layer', () => {
    it('valid SELECT passes AST', () => expectAllowed('SELECT 1'));
  });
});

describe('validateReadOnly — MongoDB', () => {
  it('simple pipeline passes', () => {
    const q = JSON.stringify({ collection: 'users', pipeline: [{ $match: { active: true } }] });
    expectAllowed(q, 'mongodb');
  });

  it('$out stage is blocked', () => {
    const q = JSON.stringify({ collection: 'users', pipeline: [{ $out: 'output_collection' }] });
    expect(() => validateReadOnly(q, 'mongodb')).toThrow(AppError);
    try {
      validateReadOnly(q, 'mongodb');
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.READONLY_VIOLATION);
    }
  });

  it('$merge stage is blocked', () => {
    const q = JSON.stringify({ collection: 'users', pipeline: [{ $merge: { into: 'other' } }] });
    expect(() => validateReadOnly(q, 'mongodb')).toThrow(AppError);
    try {
      validateReadOnly(q, 'mongodb');
    } catch (err) {
      expect((err as AppError).code).toBe(ErrorCode.READONLY_VIOLATION);
    }
  });

  it('unparseable JSON does not throw AppError', () => {
    expect(() => validateReadOnly('not json', 'mongodb')).not.toThrow();
  });
});
