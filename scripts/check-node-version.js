const major = Number.parseInt(process.versions.node.split('.')[0], 10);

const MIN_SUPPORTED_MAJOR = 20;
const MAX_SUPPORTED_MAJOR = 22;

if (Number.isNaN(major) || major < MIN_SUPPORTED_MAJOR || major > MAX_SUPPORTED_MAJOR) {
  console.error(
    [
      `Unsupported Node.js version: ${process.versions.node}`,
      `Use Node.js ${MIN_SUPPORTED_MAJOR}-${MAX_SUPPORTED_MAJOR} for this project.`,
      'Install Node 22 LTS, then restart your shell.',
      'Examples:',
      '  macOS/Linux (nvm): nvm install 22 && nvm use 22',
      '  Windows (nvm-windows): nvm install 22.22.0 && nvm use 22.22.0',
    ].join('\n')
  );
  process.exit(1);
}
