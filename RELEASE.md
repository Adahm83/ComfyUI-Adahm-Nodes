# Release checklist

This checklist is for maintainers preparing a public release.

1. Inspect the complete diff and verify that no personal paths, credentials,
   model files, generated archives, or private screenshots are included.
2. Run the embedded-Python tests and JavaScript checks from `README.md`.
3. Perform the relevant live ComfyUI/browser checks and record unavailable
   GPU or server checks.
4. Update `CHANGELOG.md`.
5. Choose the next semantic version: patch for fixes, minor for compatible
   features, or major for breaking changes.
6. Update the version in the repository's release metadata when that metadata
   is added.
7. Commit the verified change and create a matching tag such as `v0.1.0`.
8. Push the branch and tag to GitHub.
9. Create a GitHub release using the tag and summarize user-visible changes.
10. Install the release into a clean ComfyUI `custom_nodes` directory and
    verify that the documented nodes load.

Do not force-push or rewrite published history without explicit approval.
