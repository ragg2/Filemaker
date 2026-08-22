# Copilot instructions

<!-- BEGIN STANDARDS — generated from dev-standards/STANDARDS.md, do not edit here -->

## How to build

How software gets built on Andrew Harp's projects. This is the method, and it
is the same everywhere; what is specific to the codebase you are in follows
after it.

It is generated. Edit `dev-standards/STANDARDS.md` and run its `sync.mjs` —
never edit this copy in place, because the next sync will overwrite it.

It deliberately names no vendor and relies on no product feature, so the same
text serves any coding agent, including a locally hosted one later. It is
plain Markdown: if a tool has no convention of its own, point it at this file.

Keep it short. Agents load this on every turn, so length is a running cost. If
something here stops being true, change it rather than adding an exception.

---

## 1. Verify against the running thing

A green test suite is evidence about the code that has tests. It is not
evidence that the software works.

- Load the real page. Run the real command. Click the thing.
- A successful deploy says the pipeline ran. It says nothing about which
  version is being served. Fetch the deployed thing and compare it against
  what you built, byte for byte. Caches, CDNs, and service workers serve
  stale copies and report success while doing it.
- Know which parts have no coverage and say so: a frontend with no build step,
  a shell script, a migration, and a config file are all invisible to unit
  tests.
- If you cannot verify something, say which parts are unverified rather than
  letting "done" imply it.

This is not theoretical. On one project, two live bugs got past a clean
typecheck, 251 passing tests, and byte-matched assets. Both took under a
minute to find once a real screen was open.

## 2. Say what is actually true

- Distinguish verified, assumed, and skipped. "Deployed but not clicked" is a
  useful sentence.
- Report failures with their output, not a summary of their character.
- If a test asserts the wrong thing, the test was wrong. Fix it and say so.
- Never invent data that sends someone somewhere real or costs them money:
  coordinates, addresses, phone numbers, account numbers, prices. Leave it
  blank and ask.
- Do not claim a fix works because it should. Show the check without being
  asked: what was run, and what came back. If the owner has to ask for the
  evidence, the report was not finished. This is what "deployed" costs — the
  fetched version alongside the built one, every time.

## 3. Fix causes, not symptoms

- Two places building the same thing will drift. Make it one place.
- When a product may have native clients, keep domain rules, validation, data
  access, authentication contracts, and synchronization independent of browser
  rendering and browser-only storage. Platform interfaces may be rebuilt;
  product behaviour and API contracts should remain reusable.
- When persistent user data is meant to follow a user across clients or devices,
  the authenticated server account is authoritative. Every supported client
  uses the same documented synchronization and conflict rules, and server
  changes remain compatible with supported installed clients that cannot update
  immediately.
- When a bug is possible because of the shape of the code, change the shape. A
  comment saying "remember to also update X" is a bug with a delay on it.
- Before extending a rule to a new case by analogy, check that it really is
  the same case, and write the distinction where the next person will hit it.
- Prefer the smaller diff that removes the possibility over the larger one
  that handles the instance.

## 4. Safety rails must not cry wolf

A warning that fires on a correct answer is worse than no warning, because the
next real one gets ignored too. The same goes for a confirmation nobody can
act on and a log line nobody reads.

Where a rail exists because of a physical-world consequence — contamination, a
wrong delivery, lost money, lost data — pin it with a test that fails loudly
if someone removes it, and say in the test why it exists.

## 5. Write down the why

Code says what it does. Comments and commit messages carry what cannot be
recovered by reading it:

- the constraint that forced this shape
- the alternative that was tried and rejected, and what happened
- the measurement behind a number
- the bug this arrangement prevents

Record bugs you introduced and how they were caught — the mechanism recurs.
Do not narrate the obvious, and do not write a comment that the next edit
makes false.

## 6. Deploys, migrations, and data

- Never a bare deploy. Always name the environment.
- Every supported deployment target must be reachable through one guarded,
  cross-platform entry point. Platform-specific commands delegate to that
  implementation; they do not copy its gates. A target is not supported until
  its complete pre-deploy and post-deploy verification path is available.
- When work is ready to deploy, deploy it to the named test environment without
  waiting for separate approval, then verify what the test site serves. A green
  test deployment does not authorize production.
- Production deployment always requires the owner's explicit approval. Do not
  infer it from completed work, a green test site, a merge request, or a request
  that does not name production.
- For a repository that serves production, merging to `main` triggers its
  named production deployment. Merge only after production deployment has been
  explicitly approved; that approved merge is the production authorization.
  The workflow still verifies what is served before reporting success.
- Every non-production site displays a persistent, unmistakable **TEST** label
  in its interface. A test hostname or browser tab title alone is not enough;
  the environment must remain obvious while someone is using the page.
- Prove the release-tag creation path before changing `main`. Release metadata
  never points at a tag that does not exist, and the release operation is not
  complete until the remote tag resolves to the recorded commit. If direct tag
  pushes are restricted, use the hosting provider's refs API rather than
  leaving `main` in a knowingly broken intermediate state.
- Run production releases only through their authorized release workflow. The
  release runner refuses before deployment from an agent checkout, because its
  proxy may accept branch pushes while rejecting tag refs.
- Treat a release as one serialized operation: deploy and verify one immutable
  commit, tag that commit through the remote API, regenerate derived records,
  then commit the evidence. The tag names shipped code; the later commit that
  contains the release record is bookkeeping and must not pretend to be the
  shipped commit. Retry generated-record pushes after rebasing so concurrent
  automation cannot turn a verified release into a non-fast-forward failure.
- Migrations are applied explicitly, never as a side effect of a deploy.
- Prefer read-only checks against production. Do the writes on a test
  environment.
- Verify multi-statement database commands actually applied. Some engines run
  the first statement, drop the rest, and report success.
- Clean up test fixtures when finished, and say what was removed.
- Never commit personal data, addresses, exports, database dumps, or secrets.
- Pin checkout line endings in `.gitattributes` when builds or deploys read
  bytes from the working tree. Reapply new attributes with the repository's
  safe normalization script; never use a hard reset as a normalization tool.

## 7. Commit only what you changed

More than one session can be open on the same checkout, and git does not
record which session made a change. Anything that stages the whole tree —
`git add -A`, `git commit -a` — sweeps up the other session's half-finished
work, and the result looks like an ordinary commit afterwards.

- Stage the paths you edited, by name.
- Read `git status` before committing. Changes you did not make are a signal:
  name them and leave them alone rather than absorbing them.
- The same care applies in reverse. `git checkout .`, `git stash`, and a hard
  reset destroy work that may not be yours.
- Say which files a commit contains, not just what it does.

Sequencing the sessions by hand — finish one before opening another — holds
only until someone forgets. Scoping the commit removes the possibility.

## 8. Documentation is part of the work

- A change is not finished until the docs that would mislead someone are
  updated. Stale setup docs are not harmless: they get read by people and by
  tools, and both act on them.
- Update forward-looking docs. Do not rewrite dated records — "verified on
  2026-08-11 against X" was true when written, and editing it to match the
  present makes the record worth less.
- Keep a changelog of shipped behaviour, separate from planned work.

## 9. Scope and judgement

- Do the task asked, and finish it. Do not quietly narrow, widen, or
  substitute it.
- Make routine judgement calls; ask only when different readings lead to
  materially different work.
- If part of the task is blocked, complete everything else and say exactly
  what was left and why. Scaling the work down is the owner's call.
- Raise a real concern in a sentence or two, then keep building under stated
  assumptions.
- Stop before actions that are hard to reverse or outward-facing without
  confirming: deletes, force pushes, production writes, anything that sends
  something to another person.
- Work that grows past what was asked stops and asks, even when the growth is
  an improvement. Finishing the task properly is not growth — a test your
  change broke is part of the change. Fixing what you noticed on the way past
  is, and so is any choice with more than one defensible answer.
- Saying it afterwards is not asking. It arrives after the only moment the
  answer could have changed anything.

Scope grows one reasonable step at a time, which is why "do not widen" does not
catch it alone: each step follows from the last, and none of them feels like a
decision. The tell is not how large the change is but where it came from — work
you were given, or work you found. Found work gets named and offered, not
absorbed.

## 10. Hand the work over

More than one session will touch this, on more than one machine, and none of
them can read each other's chat. Anything that exists only in a conversation
is lost when it closes.

- Before editing, read `git status -sb` and the last few commits. Work you do
  not recognise belongs to another session: name it, do not absorb it, and do
  not revert it.
- Leave the tree in a state someone else can pick up — committed, or described
  in the same breath as saying you are stopping.
- Where a change has a pull request, that is the handoff document. Keep its
  description matching the branch, including what is unverified and what is
  left. A description that only covers the first commit is worse than none,
  because it reads as current.
- Before opening a pull request, look for one already open on the same work,
  and push to that branch instead. Sessions cannot see each other, so two of
  them solving one problem produce two branches that each look reasonable
  alone and collide on merge. This is not hypothetical: a hand-applied copy of
  these standards and the automated one landed in the same repository hours
  apart, and the duplicate had to be unpicked by hand.
- Say what you were about to do next. Git records what happened; nothing
  records what was planned, and that is usually the expensive half.
- Do not schedule recurring check-ins on a pull request. Subscribing to its
  events is enough: those fire when something actually happened, and a timer
  fires whether or not anything did. Waking hourly on a pull request that is
  waiting on the owner costs real money to re-read a state nobody changed,
  and it trains the owner to ignore the notification that matters. The owner
  decides when a pull request merges; a session that has said what it is
  waiting for has finished its turn.

<!-- END STANDARDS -->
