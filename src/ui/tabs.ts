import type { App } from '../app';

export function mountTabs(app: App, container: HTMLElement): { update: () => void } {
  const strip = document.createElement('div');
  strip.className = 'tab-strip';
  container.appendChild(strip);

  function update(): void {
    // Don't rebuild while a rename input is open (it would drop focus mid-edit).
    if (strip.querySelector('input.tab-rename')) return;
    strip.replaceChildren();
    const tabs = app.workspace.tabs;
    const closable = tabs.length > 1;
    for (const tab of tabs) {
      strip.appendChild(tabEl(tab.id, tab.name, tab.id === app.workspace.activeTabId, closable));
    }
    const add = document.createElement('button');
    add.className = 'tab-add';
    add.textContent = '+';
    add.title = 'New tab';
    add.addEventListener('click', () => app.addTab());
    strip.appendChild(add);
  }

  function tabEl(id: string, name: string, active: boolean, closable: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = active ? 'tab active' : 'tab';
    el.dataset.tabId = id;

    const label = document.createElement('span');
    label.className = 'tab-name';
    label.textContent = name;
    el.appendChild(label);

    el.addEventListener('click', () => app.switchTab(id));
    label.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      beginRename(el, id, name);
    });

    if (closable) {
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.textContent = '×';
      close.title = 'Close tab';
      close.addEventListener('click', (ev) => {
        ev.stopPropagation(); // don't also switch to the tab
        app.closeTab(id);
      });
      el.appendChild(close);
    }
    return el;
  }

  function beginRename(el: HTMLElement, id: string, current: string): void {
    const input = document.createElement('input');
    input.className = 'tab-rename';
    input.value = current;
    el.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (write: boolean): void => {
      if (done) return;
      done = true;
      const value = input.value;
      input.remove();                 // take the input out before any re-render
      if (write) app.renameTab(id, value); // commit -> render -> update() rebuilds the strip
      else update();                   // cancel: rebuild from the model
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  return { update };
}
