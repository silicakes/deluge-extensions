# Commands Package

This directory contains the modular SysEx command system for interacting with the Synthstrom Deluge.

## Overview

Commands are organized into categories:

- `_shared`: internal utilities (packing, parsing, transport).
- `session`: session commands (`ping`, `openSession`, `closeSession`).
- `fileSystem`: file system commands (`readFile`, etc.).
- `deviceStatus`: device diagnostic commands (`getVersion`, `getFeatures`).
- `display`: display commands (`getOLED`, `get7Seg`, `flipScreen`, etc.).

## Usage

Import from the commands barrel:

```ts
import { ping, openSession, readFile } from "@/commands";
// or
import { getVersion } from "@/commands/deviceStatus";
```

## Principles

- **DX First**: Zero boilerplate for creating commands.
- **Pure Functions**: All packing/parsing logic is side-effect-free.
- **Typed I/O**: Schemas defined with Zod for request/response validation.
- **Test Coverage**: Aim for ≥90% coverage in `src/commands`.
