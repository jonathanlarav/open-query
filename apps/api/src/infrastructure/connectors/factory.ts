import { decrypt } from '../crypto/encryption.js';
import type { DatabaseConnector } from './types.js';
import { PostgresConnector } from './postgres.connector.js';
import { MySQLConnector } from './mysql.connector.js';
import { SQLiteConnector } from './sqlite.connector.js';
import { MongoDBConnector } from './mongodb.connector.js';
import type { SelectConnection } from '@open-query/db';
import type { CreateConnectionInput, DatabaseCredentials } from '@open-query/shared';
import { AppError } from '../../shared/errors/app-error.js';
import { ErrorCode } from '@open-query/shared';

function buildConnector(type: string, credentials: DatabaseCredentials['credentials']): DatabaseConnector {
  switch (type) {
    case 'postgres':
      return new PostgresConnector(credentials as ConstructorParameters<typeof PostgresConnector>[0]);
    case 'mysql':
      return new MySQLConnector(credentials as ConstructorParameters<typeof MySQLConnector>[0]);
    case 'sqlite':
      return new SQLiteConnector(credentials as ConstructorParameters<typeof SQLiteConnector>[0]);
    case 'mongodb':
      return new MongoDBConnector(credentials as ConstructorParameters<typeof MongoDBConnector>[0]);
    default:
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Unsupported database type: ${String(type)}`,
        statusCode: 400,
      });
  }
}

export function getConnector(connection: SelectConnection): DatabaseConnector {
  const { type, credentials } = JSON.parse(decrypt(connection.encryptedCredentials)) as DatabaseCredentials;
  return buildConnector(type, credentials);
}

export function getConnectorFromCredentials(input: CreateConnectionInput): DatabaseConnector {
  return buildConnector(input.type, input.credentials);
}
