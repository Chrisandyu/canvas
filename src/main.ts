import { mount } from "svelte";
import App from "./App.svelte";
import { applyTheme, loadTheme } from "./theme";
import "./theme.css";

applyTheme(loadTheme());
mount(App, { target: document.body });
