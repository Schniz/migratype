import * as t from "io-ts";
import * as prettier from "prettier";
import _ from "lodash";
import { isDeepStrictEqual } from "util";

type TypeDef =
  | { type: "basic"; name: string }
  | { type: "literal"; value: any }
  | { type: "obj"; properties: { [key: string]: TypeDef } }
  | { type: "intersection"; of: TypeDef }
  | { type: "union"; of: TypeDef[] };

export function printType(
  type: t.Any & { props?: any; types?: any[] }
): TypeDef {
  if (type.props) {
    const properties: { [key: string]: TypeDef } = {};
    for (const [name, subtype] of Object.entries(type.props)) {
      properties[name] = printType(subtype as any);
    }
    return { type: "obj", properties };
  } else if (type.types && type instanceof t.UnionType) {
    return { type: "union", of: type.types.map(printType) };
  } else if (type.types && type instanceof t.IntersectionType) {
    const properties = type.types
      .map(printType)
      .map((x: any) => x.properties)
      .reduce(
        (acc: object, curr: object) => {
          return { ...acc, ...curr };
        },
        {} as { [key: string]: TypeDef }
      );
    return { type: "intersection", of: { type: "obj", properties } };
  } else {
    console.log(type);
    if (type instanceof t.LiteralType) {
      console.log("yes");
      return { type: "literal", value: type.value };
    }
    console.log("no");
    return { type: "basic", name: type.name };
  }
}

export function deepEqual(a: any, b: any) {
  return isDeepStrictEqual(a, b);
}

export function toIoTsString(typedef: TypeDef): string {
  switch (typedef.type) {
    case "basic":
      return `t.${typedef.name}`;
    case "literal":
      return `t.literal(${JSON.stringify(typedef.value)})`;
    case "obj":
      const obj: string[] = [];
      for (const [key, subtype] of Object.entries(typedef.properties)) {
        const stringKey = JSON.stringify(key);
        obj.push(`${stringKey}: ${toIoTsString(subtype)}`);
      }
      return `t.type({${obj.join(", ")}})`;
    case "intersection":
      return toIoTsString(typedef.of);
    case "union":
      const typedefs = typedef.of.map(toIoTsString);
      return `t.union([${typedefs.join(", ")}])`;
  }
}

export function toTypeString(typedef: TypeDef): string {
  switch (typedef.type) {
    case "basic":
      return typedef.name;
    case "literal":
      return JSON.stringify(typedef.value);
    case "obj":
      const properties = _.mapValues(typedef.properties, x => toTypeString(x));
      const everything = _.entries(properties)
        .map(([key, type]) => `"${key}": ${type}`)
        .join(";\n");
      return `{\n${everything}\n}`;
    case "intersection":
      return toTypeString(typedef.of);
    case "union":
      return typedef.of.map(toTypeString).join(" | ");
  }
}

export function toRootTypeString(name: string, typedef: TypeDef): string {
  return `export type ${name} = ${toTypeString(typedef)};`;
}

export function migrationFunctionType(name: string): string {
  return `export type ${name}_MigrationFn<T> = (before: ${name}) => T;`;
}

import * as x from "./try.ts-io";
import fs from "fs";

type LockfileTypes = {
  [key: string]: {
    versions: TypeDef[];
  };
};

function readTypeFile(): LockfileTypes {
  try {
    const file = fs.readFileSync("./try.ts-io.typelock.json", "utf8");
    return JSON.parse(file) as LockfileTypes;
  } catch (e) {
    return {};
  }
}

function main() {
  const typefile = readTypeFile();

  for (const [key, value] of Object.entries(x)) {
    if (!(value instanceof t.Type)) continue;
    const typedef = printType(value);
    const typeVersions = _.get(typefile, [key, "versions"]) || [];

    if (deepEqual(typedef, _.last(typeVersions))) {
      console.log("THE SAME, NOT CHANGING");
      continue;
    }

    console.log("not the same, changing!");

    typefile[key] = typefile[key] || {
      versions: []
    };
    typefile[key].versions.push(typedef);
  }

  let output = "import * as t from 'io-ts';";
  for (const [name, { versions }] of Object.entries(typefile)) {
    let i = 0;
    const typeNames = [] as string[];
    for (const typedef of versions) {
      i++;
      const version = `v${i}`;

      const versionPrefix =
        i === versions.length ? name : `${version}__${name}`;
      const previousVersionPrefix = i > 1 ? `v${i - 1}__${name}` : null;
      const str = `export type ${versionPrefix} = ${toTypeString(typedef)};`;
      const str3 = previousVersionPrefix
        ? `export type ${versionPrefix}_MigrationFn = (before: ${previousVersionPrefix}) => ${versionPrefix};`
        : "";
      typeNames.push(`${versionPrefix}Type`);
      const iotstr = `export const ${versionPrefix}Type = ${toIoTsString(
        typedef
      )};`;
      const prettified = prettier.format([str, iotstr, str3].join("\n"), {
        parser: "typescript"
      });
      output += `\n${prettified}`;
    }
    const prettifiedTypes = prettier.format(
      `export const ${name}_iots = [${typeNames.join(", ")}]`,
      { parser: "typescript" }
    );
    output += `\n${prettifiedTypes}`;
  }

  fs.writeFileSync("./try.ts-io.typelock.ts", output);
  fs.writeFileSync("./try.ts-io.typelock.json", JSON.stringify(typefile));
}

main();
