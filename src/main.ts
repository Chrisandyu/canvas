import { invoke } from "@tauri-apps/api/core";
import { mount } from "svelte";
import App from "./App.svelte";
import { applyTheme, loadTheme } from "./theme";
import { start } from "./store.svelte";
import "./theme.css";

applyTheme(loadTheme());
mount(App, { target: document.body });
// Saved cookies must be back in place before the first request, or it would trigger a login.
invoke("restore_session").then(start);
