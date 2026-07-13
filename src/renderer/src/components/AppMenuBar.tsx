import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

type MenuId = 'file' | 'edit' | 'view' | 'help' | null;

type MenuItem =
  | { type: 'item'; label: string; shortcut?: string; action: () => void | Promise<void> }
  | { type: 'separator' };

function getAppApi() {
  const appApi = window.sitescop?.app;
  if (!appApi?.openHelp) {
    throw new Error(
      'Menu not ready. Close ALL SiteScop windows, then double-click START-SITESCOP.bat again.',
    );
  }
  return appApi;
}

function run(action: () => void | Promise<void>) {
  void Promise.resolve(action()).catch((error) => {
    const message = error instanceof Error ? error.message : 'Menu action failed.';
    window.alert(message);
  });
}

export function AppMenuBar() {
  const [open, setOpen] = useState<MenuId>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuReady = typeof window.sitescop?.app?.openHelp === 'function';

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(null);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const menus: Record<Exclude<MenuId, null>, { label: string; items: MenuItem[] }> = {
    file: {
      label: 'File',
      items: [
        {
          type: 'item',
          label: 'Reload SiteScop',
          shortcut: 'Ctrl+R',
          action: () => getAppApi().reload(),
        },
        { type: 'separator' },
        {
          type: 'item',
          label: 'Quit SiteScop',
          shortcut: 'Ctrl+Q',
          action: () => getAppApi().quit(),
        },
      ],
    },
    edit: {
      label: 'Edit',
      items: [
        { type: 'item', label: 'Undo', shortcut: 'Ctrl+Z', action: () => getAppApi().edit('undo') },
        { type: 'item', label: 'Redo', shortcut: 'Ctrl+Y', action: () => getAppApi().edit('redo') },
        { type: 'separator' },
        { type: 'item', label: 'Cut', shortcut: 'Ctrl+X', action: () => getAppApi().edit('cut') },
        { type: 'item', label: 'Copy', shortcut: 'Ctrl+C', action: () => getAppApi().edit('copy') },
        { type: 'item', label: 'Paste', shortcut: 'Ctrl+V', action: () => getAppApi().edit('paste') },
        {
          type: 'item',
          label: 'Select All',
          shortcut: 'Ctrl+A',
          action: () => getAppApi().edit('selectAll'),
        },
      ],
    },
    view: {
      label: 'View',
      items: [
        { type: 'item', label: 'Zoom In', shortcut: 'Ctrl++', action: () => getAppApi().zoom('in') },
        { type: 'item', label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => getAppApi().zoom('out') },
        {
          type: 'item',
          label: 'Actual Size',
          shortcut: 'Ctrl+0',
          action: () => getAppApi().zoom('reset'),
        },
        { type: 'separator' },
        {
          type: 'item',
          label: 'Toggle Full Screen',
          shortcut: 'F11',
          action: () => getAppApi().toggleFullscreen(),
        },
        {
          type: 'item',
          label: 'Exit Full Screen',
          shortcut: 'Esc',
          action: () => getAppApi().exitFullscreen(),
        },
      ],
    },
    help: {
      label: 'Help',
      items: [
        {
          type: 'item',
          label: 'User Guide (searchable)',
          shortcut: 'F1',
          action: () => getAppApi().openHelp(),
        },
        {
          type: 'item',
          label: 'About us',
          action: () => getAppApi().openAbout(),
        },
      ],
    },
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 top-0 z-[60] flex h-10 items-center gap-1 border-b border-emerald-900/30 bg-gradient-to-r from-[#14533a] via-[#1b6b4a] to-[#1f5f72] px-2 shadow-md"
    >
      <div className="mr-2 flex items-center gap-2 px-2">
        <span className="rounded bg-amber-300/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-emerald-950">
          V6
        </span>
        <span className="hidden text-xs font-semibold text-white/90 sm:inline">SiteScop menu</span>
        {!menuReady ? (
          <span className="text-[11px] font-medium text-amber-100/90">Restart app to enable</span>
        ) : null}
      </div>

      {(Object.keys(menus) as Array<Exclude<MenuId, null>>).map((id) => {
        const menu = menus[id];
        const isOpen = open === id;
        return (
          <div key={id} className="relative">
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-bold text-white transition',
                isOpen ? 'bg-white/20' : 'hover:bg-white/15',
              )}
              onClick={() => setOpen(isOpen ? null : id)}
              onMouseEnter={() => {
                if (open) setOpen(id);
              }}
            >
              {menu.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {isOpen && (
              <div className="absolute left-0 top-[calc(100%+4px)] min-w-[240px] overflow-hidden rounded-xl border border-emerald-900/15 bg-white py-1.5 shadow-xl">
                {menu.items.map((item, index) => {
                  if (item.type === 'separator') {
                    return <div key={`sep-${index}`} className="my-1 border-t border-slate-200" />;
                  }
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="flex w-full items-center justify-between gap-6 px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-emerald-50 hover:text-emerald-900"
                      onClick={() => {
                        setOpen(null);
                        run(item.action);
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut ? (
                        <span className="text-xs font-semibold text-slate-400">{item.shortcut}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
