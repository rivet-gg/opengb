# Open Game Backend

## Prerequisites

- Deno
- Docker ([#125](https://github.com/rivet-gg/opengb/issues/125))
- Git

## Install

<!--
 **From GitHub (recommended)**

```
deno install --allow-net --allow-read --allow-env --allow-run --allow-write --name opengb --force https://raw.githubusercontent.com/rivet-gg/opengb-engine/main/src/cli/main.ts
```
-->

**From source**

After cloning the repo, run:

```
deno install --allow-net --allow-read --allow-env --allow-run --allow-write --name opengb --force src/cli/main.ts
```

## Usage

**Start development server**

```
opengb dev
```

This will automatically restart when files change.

> **Tip**
>
> You can configure the database url using the `DATABASE_URL` env var. This will
default to `postgres://postgres:password@localhost:5432/postgres`

**Run tests**

```
opengb test
```

To automatically rerun tests when files change, run:

```
opengb test --watch
```

To test a specific file:

```
opengb test foo
```

**Creating modules & scripts**

Create module:

```
opengb create module foo
```

Create script:

```
opengb create script foo bar
```

**Generate SDKs**

```
opengb sdk generate
```

SDKs are generated to `_gen/sdks/`.

**OpenAPI & Postman/Insomnia/Paw**

Explore the APIs by opening `_gen/openapi.json` in Postman/Insomnia/Paw.

## Goals

- **Modular** Add, remove, and modify modules from the backend to fit the use
  case for your game
- **Easy to use for game devs** The Engine takes care of the hard stuff so
  adding functionality is dead simple
- **Secure & load tested** Security, laod testing & anti-botting is not an
  afterthought
- **Strict schemas & documentation** Strict typings & documentation are
  _required_ to make this easy to approach
- **Portable & lightweight** Built on boring, reliable technology that runs
  however you want to run Open Game Backend
- **Package manager for game services** Adding backend functionality to your
  game should be as easy as one command
- **Permissively licensed** Apache 2.0 license allows developers to adapt,
  modify, & redistribute

## Technologies Used

- Language: TypeScript
- Runtime: Deno
- Database: Postgres
- ORM: Prisma

## Who uses Open Game Backend?

TODO

## FAQ

See [here](./docs/FAQ.md).

## Support

**Community**

Create a GitHub issue.

**Enterprise**

The following companies provide enterprise support & custom modules for Open Game Backend:

- [Rivet](https://rivet.gg/support)
- _Create a PR to list your services for Open Game Backend_
