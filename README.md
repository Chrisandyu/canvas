# Canvas
Desktop client for canvas w/ Tauri + Svelte  
Only works for ucla canvas
100x faster than the website!!!
Synced grade calculation from gradescope

## Setup (arch)
`sudo pacman -S webkit2gtk-4.1'  
'npm i`

## Run
dev:  
`npm run tauri dev`

build + install to ~/.local/bin/canvas  
`npm run install-app`  

## How it works
- Login w/ SSO  or auto detect logged-in browser
- Session cookie is saved in webview cookie store  
- Rust for api calls  
- Every API response is cached to disk (preloading!!!)

NOT TESTED ON WINDOWS OR MAC

![dashboard](dashboard.png)
