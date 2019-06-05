# `migratype`

> 🔒▶🔒 Safe runtime type migrations for TypeScript. Stay safe! 🙏

🤝 Change your payload types with confidence

🔒 Built on top of the amazing `io-ts` library

## Why?

TypeScript and static types in general provide great developer experience, ensuring type assertions on compile time. This, however, have no guarantee that a 3rd party, like a user or a database of some sort, will provide the exact data structure as your software expects. This is an accident waiting to happen. This is where `io-ts` gets into the picture, and provide a runtime mechanism to decode `any` values to your types, safely.

But this is not enough too.

Type definitions tend to change, as we add more features. Our schema change, and there might be some incompatibility between our server and our client. It can be a service worker that cached an older version of your front-end, or it can be a CLI tool that a project hasn't updated yet. It can even be a MongoDB database that stores an old version of your payload.

Right now, the way of handling these changes is to guard against malformed data directly in your code. You can use `io-ts` to verify that the input and expected type definition are aligned, but if you want to migrate between older to newer schema versions, well, you're out of luck, and you have to do it manually.

This is where `migratype` comes to play.

## Usage

`migratype` is a runtime library that allow you to stack `io-ts` declarations on top of each other to declare a relationship of migrations between types:

```ts
import { migratype } from "migratype";
import * as t from "io-ts";
import { right, left } from "fp-ts/lib/Either";

const User = migratable("User", t.string) // Let's say we declare a user by it's full name
  .extend({
    type: t.type({ name: t.string }), // then we understand that we may want to have something more than just a string
    migrate: name => right({ name }) // now, we have to provide a migration function between the types
  })
  .extend({
    type: t.type({
      // now we want to split first and last name
      firstName: t.string,
      lastName: t.string
    }),
    migrate: ({ name }) => {
      const [firstName, lastName] = name.split(" ", 2); // split the name into 2 strings

      if (!lastName && firstName === "Madonna") {
        return right({ firstName: "Madonna", lastName: "⭐🌟✨" }); // Madonna is an exception
      } else if (!lastName) {
        return left({
          // use `Either.left` to tell that a migration failed
          key: "name",
          message: "Name doesn't have any spaces, therefore can't be migrated"
        });
      }

      return right({ firstName, lastName }); // Either.right is for successful migration
    }
  });

User.decode("Scott Pilgrim"); // right({ firstName: "Scott", lastName: "Pilgrim" })
User.decode({ name: "Scott Pilgrim" }); // right({ firstName: "Scott", lastName: "Pilgrim" })
User.decode("Scott"); // left(...)
User.decode("Madonna"); // right({ firstName: "Madonna", lastName: "⭐🌟✨" })
```

## More thoughts 🤔

The only reference I found for migratable types in any language, is [Milk](https://github.com/jaredly/milk). Milk is a layer on top of multiple ReasonML JSON parsers, and has the notion of type migrations.

I think it would be very nice to have a "lockfile" of some sort that will be generated in a build step, to reduce the verboseness of the type definitions (`migratable.extend.extend.extend...`). This, however, makes another build step and it is kinda error-prone, but I think it's an area worth exploring.

Stay safe.
