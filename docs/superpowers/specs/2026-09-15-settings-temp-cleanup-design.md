# Settings Temporary-File Cleanup Design

## Goal

Prevent failed desktop settings writes from leaving `settings.*.tmp` files in Electron's user-data directory, while preserving atomic replacement of `settings.json`.

## Root cause

`desktop/settings.ts` writes each update to a uniquely named temporary file and then renames that file over `settings.json`. The temporary file is only consumed when `rename()` succeeds. If writing succeeds but renaming fails, the temporary file is abandoned. Repeated failed writes or interrupted launches can therefore create unbounded `settings.<pid>.<uuid>.tmp` files.

## Design

Keep the existing per-write unique temporary path and atomic `rename()` operation. Wrap the write and rename sequence in `try/finally`; once the temporary path has been created, attempt to remove it in the `finally` block. Cleanup should be best-effort and must not hide the original write or rename error. A successful rename makes the temporary path nonexistent, so cleanup is harmless after successful writes.

The fix is limited to the settings store. It will not perform startup garbage collection of pre-existing stale files; those remain a one-time manual cleanup.

## Error handling

- Preserve the current serialized save queue.
- Preserve the current behavior and error propagation when `writeFile()` or `rename()` fails.
- If cleanup itself fails, do not replace the original operation error with the cleanup error.
- Do not delete arbitrary files: cleanup targets only the temporary path generated for the current write.

## Testing

Add a focused regression test in `test/desktop-settings.test.ts` that exercises a failed atomic replacement and verifies the generated temporary file is removed. The test should continue to cover successful persistence and concurrent save serialization through the existing tests.

The implementation will be validated with the focused desktop settings test, TypeScript typechecking, linting, and formatting checks for changed files.
