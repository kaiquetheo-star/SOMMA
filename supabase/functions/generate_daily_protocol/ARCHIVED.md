# Archived Edge Function

`index.ts` is a historical fork of the protocol generator and is retained only
for reference. The application runs in local-first mode and generates protocols
through `lib/gameplan/engine/generateDeterministicGameplan.ts`.

Do not deploy this function. Any future cloud execution must call or share the
client engine instead of evolving this fork.
