# Gemini Code Assist Configuration

This folder contains configuration files for Gemini Code Assist integration with the CotA.i project.

## Files

- `config.yaml` - Main configuration file for Gemini Code Assist behavior
- `style-guide.md` - Custom code review style guide for this project

## Usage

Once the Gemini Code Assist GitHub App is installed and configured:

1. **Automatic Reviews**: When a PR is opened, Gemini will automatically review it within 5 minutes
2. **Manual Commands**: Use these commands in PR comments:
   - `/gemini review` - Request a code review
   - `/gemini summary` - Get a PR summary
   - `@gemini-code-assist` - Ask specific questions
   - `/gemini help` - Show available commands

## Configuration Notes

- Reviews focus on security, performance, best practices, code quality, and maintainability
- Supports TypeScript, JavaScript, React (TSX/JSX), JSON, YAML, and Markdown files
- Excludes build artifacts, node_modules, and generated files
- Uses project-specific style guide for consistent feedback

## Troubleshooting

If Gemini Code Assist is not working:
1. Ensure the GitHub App is properly installed on the repository
2. Check that the bot has appropriate permissions
3. Verify the configuration files are valid
4. Create a test PR to trigger the review process