import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import { useNexus } from '../../state/NexusContext';
import { decodeBase64ToUint8Array, encodeBase64Utf8, nexusBridge } from '../../bridge/nexusBridge';
import { applyControlModifier } from '../../constants/shortcuts';

const XtermViewport = React.forwardRef(function XtermViewport(
  {
    sessionId,
    mode = 'pty',
    ctrlActive = false,
    altActive = false,
    onConsumeModifiers,
    onSelectionChange,
    onResizeNotice,
  },
  ref
) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const searchRef = useRef(null);
  const modifiersRef = useRef({ ctrlActive, altActive, onConsumeModifiers });
  modifiersRef.current = { ctrlActive, altActive, onConsumeModifiers };

  const { theme, font, settings, subscribeTerminalOutput } = useNexus();

  useImperativeHandle(ref, () => ({
    findNext: (query) => searchRef.current?.findNext(query, { incremental: false }),
    findPrevious: (query) => searchRef.current?.findPrevious(query, { incremental: false }),
    getSelection: () => termRef.current?.getSelection() || '',
    pasteText: (text) => {
      if (!text || !sessionId) return;
      const b64 = encodeBase64Utf8(text);
      if (mode === 'ssh') {
        nexusBridge.ssh.sendInput(sessionId, b64).catch(() => {});
      } else {
        nexusBridge.terminal.writeInput(sessionId, b64).catch(() => {});
      }
    },
    clear: () => termRef.current?.clear(),
    focus: () => termRef.current?.focus(),
    scrollToBottom: () => termRef.current?.scrollToBottom(),
  }));

  useEffect(() => {
    if (!containerRef.current || !sessionId) return;

    const term = new Terminal({
      allowProposedApi: true,
      allowTransparency: settings.terminalOpacity < 100,
      convertEol: false,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: font.css,
      fontSize: settings.fontSize,
      lineHeight: 1.24,
      scrollback: 5000,
      theme: {
        ...theme.xterm,
        background:
          settings.terminalOpacity < 100
            ? 'rgba(8, 12, 20, 0)'
            : theme.xterm.background,
      },
      macOptionIsMeta: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicodeAddon = new Unicode11Addon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicodeAddon);
    term.unicode.activeVersion = '11';

    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fitAddon;
    searchRef.current = searchAddon;

    const syncResize = () => {
      try {
        fitAddon.fit();
        const cols = term.cols || 80;
        const rows = term.rows || 24;
        onResizeNotice?.(cols, rows);
        if (mode === 'ssh') {
          nexusBridge.ssh.resize(sessionId, cols, rows).catch(() => {});
        } else {
          nexusBridge.terminal.resize(sessionId, cols, rows).catch(() => {});
        }
      } catch {
        // Ignore transient resize errors during mount
      }
    };

    const rafId = requestAnimationFrame(syncResize);

    // Hydrate existing scrollback buffer from native side if reconnecting/restoring tab
    if (mode === 'pty' && nexusBridge.isNative()) {
      nexusBridge.terminal
        .getSessionBuffer(sessionId)
        .then((res) => {
          if (res?.bufferBase64) {
            term.write(decodeBase64ToUint8Array(res.bufferBase64));
          }
        })
        .catch(() => {});
    }

    const dataDisposable = term.onData((data) => {
      const { ctrlActive: ctrl, altActive: alt, onConsumeModifiers: consume } =
        modifiersRef.current;
      const finalData = ctrl || alt ? applyControlModifier(data, ctrl, alt) : data;
      if (ctrl || alt) consume?.();
      const b64 = encodeBase64Utf8(finalData);
      if (mode === 'ssh') {
        nexusBridge.ssh.sendInput(sessionId, b64).catch(() => {});
      } else {
        nexusBridge.terminal.writeInput(sessionId, b64).catch(() => {});
      }
    });

    const selDisposable = term.onSelectionChange(() => {
      onSelectionChange?.(term.getSelection());
    });

    let unsub = () => {};
    let sshOutHandle = null;
    let sshCloseHandle = null;

    if (mode === 'pty') {
      unsub = subscribeTerminalOutput(sessionId, (ev) => {
        if (ev.exited) {
          term.writeln(`\r\n\x1b[38;5;214m[Process exited with code ${ev.exitCode}]\x1b[0m`);
          return;
        }
        if (ev.dataBase64) {
          term.write(decodeBase64ToUint8Array(ev.dataBase64));
        }
      });
    } else if (mode === 'ssh') {
      nexusBridge.ssh
        .addOutputListener((ev) => {
          if (ev.sshSessionId === sessionId && ev.dataBase64) {
            term.write(decodeBase64ToUint8Array(ev.dataBase64));
          }
        })
        .then((h) => {
          sshOutHandle = h;
        });
      nexusBridge.ssh
        .addClosedListener((ev) => {
          if (ev.sshSessionId === sessionId) {
            term.writeln(`\r\n\x1b[38;5;203m[SSH connection closed: ${ev.reason || 'EOF'}]\x1b[0m`);
          }
        })
        .then((h) => {
          sshCloseHandle = h;
        });
    }

    const resizeObserver = new ResizeObserver(() => {
      syncResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      selDisposable.dispose();
      unsub();
      sshOutHandle?.remove?.();
      sshCloseHandle?.remove?.();
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, mode]);

  // Live theme / font / cursor updates without killing PTY session
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = {
      ...theme.xterm,
      background:
        settings.terminalOpacity < 100 ? 'rgba(8, 12, 20, 0)' : theme.xterm.background,
    };
    term.options.fontFamily = font.css;
    term.options.fontSize = settings.fontSize;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.allowTransparency = settings.terminalOpacity < 100;
    try {
      fitRef.current?.fit();
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      if (mode === 'ssh') {
        nexusBridge.ssh.resize(sessionId, cols, rows).catch(() => {});
      } else {
        nexusBridge.terminal.resize(sessionId, cols, rows).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [theme, font, settings, sessionId, mode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden rounded-lg"
      style={{
        backgroundColor: theme.xterm.background,
        opacity: settings.terminalOpacity / 100,
      }}
      onClick={() => termRef.current?.focus()}
    />
  );
});

export default XtermViewport;

