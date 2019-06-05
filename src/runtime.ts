import * as t from "io-ts";
import { Either, right, fromOption } from "fp-ts/lib/Either";
import { findIndex } from "fp-ts/lib/Array";

export type MigrationError = {
  key: string;
  message: string;
};

export enum DecodeErrorType {
  MigrationError,
  CantDecode
}

export type DecodeError =
  | { type: DecodeErrorType.MigrationError; error: MigrationError }
  | { type: DecodeErrorType.CantDecode };

function migrationError(error: MigrationError): DecodeError {
  return { type: DecodeErrorType.MigrationError, error };
}

class MigratableType<T, BeforeType = T, AllLevels = T> {
  name: string;
  type: t.Type<T>;
  fromBefore: (before: BeforeType) => Either<MigrationError, T>;
  levels: MigratableType<any, any, any>[];

  constructor(
    name: string,
    type: MigratableType<T, BeforeType>["type"],
    fromBefore: MigratableType<T, BeforeType>["fromBefore"],
    levels: MigratableType<any, any, AllLevels>[] = []
  ) {
    this.name = name;
    this.type = type;
    this.fromBefore = fromBefore;
    this.levels = [...levels, this];
  }

  extend<Y>(opts: {
    type: t.Type<Y>;
    migration: MigratableType<Y, T>["fromBefore"];
  }): MigratableType<Y, T, AllLevels | Y> {
    return new MigratableType(
      this.name,
      opts.type,
      opts.migration,
      this.levels
    );
  }

  decode(obj: AllLevels): Either<DecodeError, T> {
    const types = this.levels;
    const typesReversed = [...types].reverse();
    return fromOption<DecodeError>({ type: DecodeErrorType.CantDecode })(
      findIndex(typesReversed, ({ type }) => {
        return type.decode(obj).isRight();
      })
    ).chain(reversedIndex => {
      const index = types.length - reversedIndex;
      const migrationFns = types
        .slice(1)
        .slice(index - 1)
        .map(x => x.fromBefore);

      const migrated = migrationFns
        .reduce((item, fn) => item.chain(fn), right<MigrationError, any>(obj))
        .mapLeft(migrationError);

      return migrated;
    });
  }
}

export type TypeOf<
  X extends MigratableType<any, any>
> = X extends MigratableType<infer T, any, any> ? T : never;
export type LevelsOf<
  X extends MigratableType<any, any, any>
> = X extends MigratableType<any, any, infer T> ? T : never;

export function migratype<T>(name: string, t: t.Type<T>) {
  return new MigratableType<T, T>(name, t, x => right(x));
}
