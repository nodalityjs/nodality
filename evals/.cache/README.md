# Cached model responses

Every response the eval scored, one file per solver and brief.

These are committed deliberately. Section 8.7 of the dissertation reports a
measurement made with a *stochastic* instrument: re-running the eval resamples
the model and produces different output, so "re-run it and see" is not a way to
check the numbers. These files are. They are the exact inputs the four gates
were applied to, and scoring them again is deterministic.

    node evals/run.mjs --solver=model --quality     # Nodality condition
    node evals/run.mjs --solver=react --quality     # baseline condition

Both read from here and make no network calls while the cache is present.
Delete a file to re-ask that one brief; delete the directory to re-ask all of
them, which starts a *new* sample rather than reproducing this one.
