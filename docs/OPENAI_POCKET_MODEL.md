# Pocket Bullseye OpenAI model configuration

`OPENAI_POCKET_MODEL` selects the OpenAI model used by Pocket Bullseye's AI chart-analysis flow.

## Configuration

- Required for the Pocket AI analysis route.
- Configure it in the appropriate deployment environment; do not commit credentials or secret values.
- Preview/staging values must remain isolated from production values.
- If the setting is absent or invalid, the analysis flow must fail closed rather than silently selecting an undocumented model.

## Operations

When changing the model, update this document and rerun the Bullseye quality gate before promotion. Record the selected model in the deployment environment, not in application source code.
