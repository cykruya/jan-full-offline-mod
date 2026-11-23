pub mod agent;
pub mod app;
#[cfg(feature = "cli")]
pub mod cli;
// Native file dialogs/IO commands and the system/tray command surface are
// desktop-only; the CLI uses std::fs and its own tools.
#[cfg(not(feature = "cli"))]
pub mod filesystem;
pub mod mcp;
// Desktop-only: the webview navigation guard.
#[cfg(not(feature = "cli"))]
pub mod navigation;
pub mod openai_schema;
pub mod server;
// Desktop-only app setup (tray, theme, window wiring); pulls in Tauri GUI types
// (Wry/AppHandle) the headless `jan` CLI build does not link.
#[cfg(not(feature = "cli"))]
pub mod setup;
pub mod state;
#[cfg(not(feature = "cli"))]
pub mod system;
pub mod threads;

// The request-signing bits of the headless CLI's update check
// (`cli::updater`). The desktop app has no updater.
#[cfg(feature = "cli")]
pub mod updater;
