import pkg from 'node-sql-parser';
const { Parser } = pkg as unknown as { Parser: new () => { astify(sql: string): unknown } };
import { AppError } from '../errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

const WRITE_KEYWORD_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|UPSERT|EXEC|EXECUTE|CALL|GRANT|REVOKE)\b/i;

const MONGO_WRITE_STAGES = new Set(['$out', '$merge']);

const parser = new Parser();

function validateMongoReadOnly(query: string): void {
  try {
    const parsed = JSON.parse(query) as { collection?: unknown; pipeline?: unknown[] };
    const pipeline = parsed.pipeline;
    if (!Array.isArray(pipeline)) return; // malformed — let connector surface the error
    for (const stage of pipeline) {
      if (stage && typeof stage === 'object') {
        const writeStage = Object.keys(stage).find((k) => MONGO_WRITE_STAGES.has(k));
        if (writeStage) {
          throw new AppError({
            code: ErrorCode.READONLY_VIOLATION,
            message: `Write stage "${writeStage}" is not allowed`,
            statusCode: 400,
          });
        }
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Unparseable JSON — let the connector surface a better error
  }
}

export function validateReadOnly(query: string, dbType?: string): void {
  if (dbType === 'mongodb') {
    validateMongoReadOnly(query);
    return;
  }

  // Layer 1: Fast regex pre-check for write keywords
  if (WRITE_KEYWORD_PATTERN.test(query.trim())) {
    throw new AppError({
      code: ErrorCode.READONLY_VIOLATION,
      message: 'Only SELECT statements are allowed',
      statusCode: 400,
    });
  }

  // Layer 2: AST parse to verify it's a SELECT
  try {
    const ast = parser.astify(query.trim());
    const statements = Array.isArray(ast) ? ast : [ast];
    for (const stmt of statements) {
      if (!stmt || (stmt as { type?: string }).type !== 'select') {
        throw new AppError({
          code: ErrorCode.READONLY_VIOLATION,
          message: 'Only SELECT statements are allowed',
          statusCode: 400,
        });
      }
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Could not parse SQL statement',
      statusCode: 400,
      cause: err,
    });
  }
}
