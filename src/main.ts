import { App } from './app';
import { mountMenuBar } from './ui/menubar';
import { mountRibbon } from './ui/ribbon';
import { mountContextMenu } from './ui/contextMenu';
import { saveWorkspace, copyTabPng } from './io/files';
import { mountProperties } from './ui/properties';
import { mountTabs } from './ui/tabs';
import { ShapeTool } from './tools/shapeTool';
import { SelectTool } from './tools/selectTool';
import { ConnectorTool } from './tools/connectorTool';
import { createAutosaver, loadDraft, clearDraft } from './io/autosave';
import { mountRestoreBar } from './ui/restoreBar';

const root = document.getElementById('app')!;
root.innerHTML = '';

const tabStripHost = document.createElement('div');
const toolbarHost = document.createElement('div');
const bodyHost = document.createElement('div');
bodyHost.className = 'app-body';
const canvasHost = document.createElement('div');
canvasHost.className = 'canvas-host';
const propsHost = document.createElement('div');
propsHost.className = 'props-host';
bodyHost.append(canvasHost, propsHost);
root.append(tabStripHost, toolbarHost, bodyHost);

// Grab any crash-recovery draft BEFORE the app can autosave over it, so a browser
// crash or accidental reload is recoverable. It is never auto-loaded — the user is
// offered a Restore/Discard bar below — so a fresh start is never silently clobbered.
const draft = loadDraft();

// Start every page load with a fresh, empty canvas; the draft is offered, not applied.
const app = new App(canvasHost);

app.registerTool('select', new SelectTool(app));
app.setTool('select');
for (const kind of ['rect', 'rounded', 'ellipse', 'diamond', 'triangle',
                    'brace-left', 'brace-right', 'bracket-left', 'bracket-right', 'text'] as const) {
  app.registerTool(kind, new ShapeTool(app, kind));
}
app.registerTool('arrow', new ConnectorTool(app));

mountMenuBar(app, toolbarHost);
const ribbon = mountRibbon(app, toolbarHost);
mountContextMenu(app, canvasHost);

const tabs = mountTabs(app, tabStripHost);
const panel = mountProperties(app, propsHost);
app.onRender = () => { panel.update(); tabs.update(); ribbon.syncActive(); };
app.onSave = () => saveWorkspace(app);
app.onCopyImage = () => void copyTabPng(app);

// Autosave: mirror the workspace to localStorage on every committed change (debounced),
// and flush the latest state when the tab is hidden or unloaded (best-effort).
const autosaver = createAutosaver();
app.onCommit = () => autosaver.schedule(app.workspace);
window.addEventListener('pagehide', () => autosaver.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosaver.flush();
});

app.render();

// Offer to recover the previous session, if one was found.
if (draft) {
  mountRestoreBar(root, draft.savedAt, {
    onRestore: () => app.replaceWorkspace(draft.workspace),
    onDiscard: () => clearDraft(),
  });
}
