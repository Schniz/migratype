import { migratype, DecodeErrorType, TypeOf } from "./runtime";
import * as t from "io-ts";
import { right, left, Left, Either, Right } from "fp-ts/lib/Either";

function isEither(x: any): Either<any, any> | null {
  if (!(x instanceof Left || x instanceof Right)) {
    return null;
  }

  return x;
}

expect.extend({
  toBeLeftWith<L>(received: any, value: L) {
    const either = isEither(received);

    if (!either) {
      return { message: () => "Provided value is not Either", pass: false };
    }

    return either.fold(
      (x: L) => {
        expect(x).toEqual(value);
        return {
          message: () => "",
          pass: true as boolean
        };
      },
      () => ({ message: () => "Received `right`, not `left`.", pass: false })
    );
  },
  toBeRightWith<L>(received: any, value: L) {
    const either = isEither(received);

    if (!either) {
      return { message: () => "Provided value is not Either", pass: false };
    }

    return either.fold(
      () => ({ message: () => "Received `left`, not `right`.", pass: false }),
      (x: L) => {
        expect(x).toEqual(value);
        return {
          message: () => "",
          pass: true as boolean
        };
      }
    );
  }
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeLeftWith(value: any): R;
      toBeRightWith(value: any): R;
    }
  }
}

it("decodes an migrated object", () => {
  const expected: User = {
    age: 27,
    firstName: "Gal",
    lastName: "Schlezinger"
  };
  const result = UserType.decode(expected);
  expect(result).toBeRightWith(expected);
});

it("migrates an object couple of levels", () => {
  const result = UserType.decode("Gal Schlezinger");
  const expected: User = {
    age: null,
    firstName: "Gal",
    lastName: "Schlezinger"
  };
  expect(result).toBeRightWith(expected);
});

it("Has an error decoding an unknown object", () => {
  const result = UserType.decode({} as any);
  expect(result).toBeLeftWith({ type: DecodeErrorType.CantDecode });
});

it("Returns a Left when there's a migration error", () => {
  const result = UserType.decode({ name: "Gal" });
  expect(result).toBeLeftWith({
    type: DecodeErrorType.MigrationError,
    error: {
      key: "name",
      message: "Name doesn't have a space in it, can't infer full name!"
    }
  });
});

const UserType = migratype("User", t.string)
  .extend({
    type: t.type({
      name: t.string
    }),
    migration: name => right({ name })
  })
  .extend({
    type: t.type({
      firstName: t.string,
      lastName: t.string
    }),
    migration: before => {
      const [firstName, lastName] = before.name.split(" ", 2);
      if (!lastName) {
        return left({
          key: "name",
          message: "Name doesn't have a space in it, can't infer full name!"
        });
      }
      return right({ firstName, lastName });
    }
  })
  .extend({
    type: t.type({
      lastName: t.string,
      firstName: t.string,
      age: t.union([t.null, t.number])
    }),
    migration: before => {
      return right({ ...before, age: null });
    }
  });

type User = TypeOf<typeof UserType>;
