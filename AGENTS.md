# Architecture
- Store generated library items in browser IndexedDB under the authenticated user's ID; this persists large image data without localStorage quota failures or sharing items across accounts.
- Classify completed AI replies in the shared library-content module and notify library views after committed writes; this keeps categories and All consistent without coupling storage to UI state.