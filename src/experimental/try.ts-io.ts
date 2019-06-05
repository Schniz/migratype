import * as t from 'io-ts';

const subtype1 = t.type({
  name: t.number,
  union: t.union([t.string, t.number]),
  intersection: t.intersection([
    t.type({ hello: t.string }),
    t.type({ welcome: t.string })
  ])
});

export const type1 = t.type({
  name: t.string,
  value: t.number,
  moreValue: t.string,
  sub1: subtype1
});

