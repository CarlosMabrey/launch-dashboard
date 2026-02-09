import React, { useEffect, useRef } from 'react';

interface CodePreviewProps {
  /** HTML code to render (can include <style> and <script> tags) */
  code: string;
  /** Additional CSS class for the container */
  className?: string;
  /** Height of the preview iframe (default: '400px') */
  height?: string | number;
  /** Width of the preview iframe (default: '100%') */
  width?: string | number;
  /** Whether to show the "Summon Full View" button on hover (default: true) */
  showOpenButton?: boolean;
  /** Custom title for iframe (default: 'Code Preview') */
  title?: string;
  /** Sandbox restrictions - default allows scripts and same-origin */
  sandbox?: string;
}

/**
 * CodePreview - A sandboxed iframe component for live HTML/CSS/JS previews
 *
 * Features:
 * - Inject arbitrary HTML/CSS/JS via srcdoc
 * - Sandboxed for security (scripts, same-origin allowed)
 * - Auto-updates when code prop changes
 * - Hover overlay with "Summon Full View" button to open in new tab
 * - Seamless integration into chat bubbles
 */
const CodePreview: React.FC<CodePreviewProps> = ({
  code,
  className = '',
  height = '400px',
  width = '100%',
  showOpenButton = true,
  title = 'Code Preview',
  sandbox = 'allow-scripts allow-same-origin allow-forms',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (doc) {
      // Clear existing content and write new code
      doc.open();
      doc.write(code);
      doc.close();

      // Optional: apply base styles for consistent rendering
      const style = doc.createElement('style');
      style.textContent = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; }
      `;
      // Inject base styles only if not overridden
      const head = doc.head;
      if (head) {
        head.insertBefore(style, head.firstChild);
      }
    }
  }, [code]);

  const handleOpen = () => {
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.focus();
    }
    // Revoke after a short delay to ensure the new tab has loaded
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className={`relative group/preview ${className}`}
      style={{ height, width }}
    >
      <iframe
        ref={iframeRef}
        sandbox={sandbox}
        title={title}
        className="w-full h-full border border-white/10 bg-black/40 rounded-xl pointer-events-none"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {showOpenButton && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end p-2">
          <button
            onClick={handleOpen}
            className="bg-violet-500/80 hover:bg-violet-500 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg text-white backdrop-blur-sm pointer-events-auto transition-colors"
            type="button"
          >
            Summon Full View
          </button>
        </div>
      )}
    </div>
  );
};

export default CodePreview;
