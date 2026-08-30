# Cached model responses

Every response the eval scored, one file per solver and brief.

These are committed deliberately. Section 8.7 of the dissertation reports a
measurement made with a *stochastic* instrument: re-running the eval resamples
the model and produces different output, so "re-run it and see" is not a way to
check the numbers. These files are. They are the exact inputs the four gates
were applied to, and scoring them again is deterministic.

    node evals/run.mjs --solver=model --quality     # Nodality condition
    node evals/run.mjs --solver=react --quality     # baseline condition

    node evals/run.mjs --solver=model --quality --repair       # Tier 7
    node evals/run.mjs --solver=model --quality --repair=full  # ...upper bound
    EVAL_MODEL=claude-haiku-4-5-20251001 node evals/run.mjs --solver=model --quality --repair

All of these read from here and make no network calls while the cache is
present. Delete a file to re-ask that one brief; delete the directory to re-ask
all of them, which starts a *new* sample rather than reproducing this one.

## File names

    <model>--<brief>.json                        the first-try answer
    <model>--<brief>--repair-<mode>-<digest>.json  the answer after one repair turn

`mode` is `library` or `full` — see evals/repair.mjs for what each one lets the
agent see. `digest` hashes the feedback text, so a repair answer is only reused
when the reports that produced it were identical.

That digest was itself evidence. `claude-sonnet-5--relays-how-it-works`,
`claude-haiku-4-5-20251001--list` and `claude-haiku-4-5-20251001--relays-footer`
all carry `repair-library-4eryo8`: three briefs, three different faults, and the
library said the same string to all three, because the throw behind it named
every valid type and no element. Those files are the BEFORE. The repair answers
carrying other digests were taken after `validate_nodes` learned to report the
entry at its own path — same briefs, same first answers, feedback that now
differs per fault. Keep both: the pair is the measurement. See Tier 7.

## Two models, deliberately

`claude-sonnet-5` and `claude-haiku-4-5-20251001`. The second is there because
Tier 6's aliases were derived from the first model's failures, and "was the
vocabulary tuned to one model?" is not answerable with one model. It also gives
the repair loop headroom the strong model does not leave.
