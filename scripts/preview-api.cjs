// Preserve npm dev:api and the existing manual Windows/WSL launchers.
// The independent runtime reads private settings and defaults to local SQLite.
require('./standalone-server.cjs').runCLI();
